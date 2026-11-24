import {
  checkMedicalEventDate,
  isRuleError,
  localDate,
  normalizeMedicalNotes,
  normalizeMedicalTitle,
  normalizeProviderName,
  type FieldErrors,
} from '@pawcare/core';
import { recordChange } from '../change-log';
import type { Database } from '../database';
import type { DataDeps } from '../deps';
import { confirmationRequired, notFound, validationFailed } from '../errors';
import { UUID, badCursor, parsePageQuery } from '../paging';
import type { SqlConnection } from '../sql';
import type { CreateMedicalEventInput, MedicalEvent, MedicalEventPage } from '../types';
import { parseCreateMedicalEventInput } from './medical-input';

export interface MedicalRepository {
  /** Records an owner-entered medical event: parent, subtype and change log in one write. */
  create(input: CreateMedicalEventInput): Promise<MedicalEvent>;
  /** Any status, archived pets included. Unknown or another owner's → `NOT_FOUND`. */
  get(id: string): Promise<MedicalEvent>;
  /**
   * A pet's ACTIVE medical events, newest date first, ID as tiebreak; archived pets included.
   * MR-03 may replace this with the timeline; MR-04 adds voided records.
   */
  listForPet(petId: string, query?: { limit?: number; cursor?: string }): Promise<MedicalEventPage>;
}

interface MedicalRow {
  id: string;
  pet_id: string;
  occurrence_date: string;
  status: MedicalEvent['status'];
  provenance: MedicalEvent['provenance'];
  void_reason: string | null;
  voided_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  event_type: MedicalEvent['eventType'];
  title: string;
  notes: string | null;
  provider_name: string | null;
}

const SELECT_MEDICAL = `
  SELECT r.id, r.pet_id, r.occurrence_date, r.status, r.provenance, r.void_reason, r.voided_at,
         r.version, r.created_at, r.updated_at, m.event_type, m.title, m.notes, m.provider_name
  FROM care_records r
  JOIN medical_events m ON m.owner_id = r.owner_id AND m.record_id = r.id`;

function toMedicalEvent(row: MedicalRow): MedicalEvent {
  return {
    id: row.id,
    petId: row.pet_id,
    eventType: row.event_type,
    title: row.title,
    occurrenceDate: row.occurrence_date,
    notes: row.notes,
    providerName: row.provider_name,
    status: row.status,
    provenance: row.provenance,
    voidReason: row.void_reason,
    voidedAt: row.voided_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface MedicalFields {
  title: string;
  occurrenceDate: string;
  notes: string | null;
  providerName: string | null;
}

/** Applies every field rule; throws one VALIDATION_FAILED listing all failures. */
function normalizeMedical(dto: CreateMedicalEventInput, today: string): MedicalFields {
  const errors: FieldErrors = {};
  const take = <T>(field: string, result: T | { error: string }): T => {
    if (isRuleError(result)) {
      errors[field] = [result.error];
      return undefined as T;
    }
    return result as T;
  };
  const fields: MedicalFields = {
    title: take('title', normalizeMedicalTitle(dto.title)),
    occurrenceDate: take('occurrenceDate', checkMedicalEventDate(dto.occurrenceDate, today)),
    notes: dto.notes === undefined ? null : take('notes', normalizeMedicalNotes(dto.notes)),
    providerName:
      dto.providerName === undefined
        ? null
        : take('providerName', normalizeProviderName(dto.providerName)),
  };
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return fields;
}

async function readActivePet(c: SqlConnection, ownerId: string, id: string) {
  if (!UUID.test(id)) return undefined;
  return c.get<{ id: string; name: string; birth_date: string | null }>(
    'SELECT id, name, birth_date FROM pets WHERE owner_id = ? AND id = ? AND archived_at IS NULL',
    [ownerId, id],
  );
}

export function createMedicalRepository(
  db: Database,
  deps: DataDeps,
  ownerId: string,
): MedicalRepository {
  return {
    async create(rawInput) {
      const dto = parseCreateMedicalEventInput(rawInput);
      return db.write(['care_records', 'medical_events', 'change_log'], async (c) => {
        const pet = await readActivePet(c, ownerId, dto.petId);
        if (!pet) throw notFound();
        const owner = await c.get<{ time_zone: string }>(
          'SELECT time_zone FROM owners WHERE id = ?',
          [ownerId],
        );
        const input = normalizeMedical(dto, localDate(owner!.time_zone, deps.now()));
        // Field errors come first; the warning only appears once every field is valid.
        if (
          pet.birth_date !== null &&
          input.occurrenceDate < pet.birth_date &&
          dto.confirmBeforeBirth !== true
        ) {
          throw confirmationRequired({
            occurrenceDate: [`This date is before ${pet.name}'s birth date. Save anyway?`],
          });
        }

        const id = deps.newId();
        const at = deps.now().toISOString();
        await c.run(
          `INSERT INTO care_records (id, owner_id, pet_id, kind, occurrence_date, created_at, updated_at)
           VALUES (?, ?, ?, 'MEDICAL', ?, ?, ?)`,
          [id, ownerId, pet.id, input.occurrenceDate, at, at],
        );
        await c.run(
          `INSERT INTO medical_events (record_id, owner_id, pet_id, event_type, title, notes, provider_name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, ownerId, pet.id, dto.eventType, input.title, input.notes, input.providerName],
        );
        await recordChange(c, deps, {
          ownerId,
          entityType: 'care_record',
          entityId: id,
          entityVersion: 1,
          action: 'medical_event.created',
          fields: [
            'petId',
            'eventType',
            'title',
            'occurrenceDate',
            ...(input.notes === null ? [] : ['notes']),
            ...(input.providerName === null ? [] : ['providerName']),
          ],
        });
        const row = await c.get<MedicalRow>(`${SELECT_MEDICAL} WHERE r.owner_id = ? AND r.id = ?`, [
          ownerId,
          id,
        ]);
        return toMedicalEvent(row!);
      });
    },

    async listForPet(petId, query = {}) {
      const { limit, cursor } = parsePageQuery(query);
      return db.read(async (c) => {
        const pet = UUID.test(petId)
          ? await c.get<{ id: string }>('SELECT id FROM pets WHERE owner_id = ? AND id = ?', [
              ownerId,
              petId,
            ])
          : undefined;
        if (!pet) throw notFound();

        let after: { occurrence_date: string; id: string } | undefined;
        if (cursor !== undefined) {
          after = await c.get<{ occurrence_date: string; id: string }>(
            `SELECT occurrence_date, id FROM care_records
             WHERE owner_id = ? AND pet_id = ? AND id = ? AND kind = 'MEDICAL'`,
            [ownerId, pet.id, cursor],
          );
          if (!after) throw badCursor();
        }
        const rows = await c.all<MedicalRow>(
          `${SELECT_MEDICAL}
           WHERE r.owner_id = ? AND r.pet_id = ? AND r.status = 'ACTIVE'
             AND (? IS NULL OR (r.occurrence_date, r.id) < (?, ?))
           ORDER BY r.occurrence_date DESC, r.id DESC
           LIMIT ?`,
          [
            ownerId,
            pet.id,
            after?.id ?? null,
            after?.occurrence_date ?? null,
            after?.id ?? null,
            limit + 1,
          ],
        );
        const page = rows.slice(0, limit);
        return {
          data: page.map(toMedicalEvent),
          nextCursor: rows.length > limit ? page[page.length - 1].id : null,
        };
      });
    },

    async get(id) {
      const row = UUID.test(id)
        ? await db.read((c) =>
            c.get<MedicalRow>(`${SELECT_MEDICAL} WHERE r.owner_id = ? AND r.id = ?`, [ownerId, id]),
          )
        : undefined;
      if (!row) throw notFound();
      return toMedicalEvent(row);
    },
  };
}
