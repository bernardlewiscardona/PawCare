import {
  checkNextDueDate,
  checkVaccinationDate,
  isRuleError,
  normalizeBatchLabel,
  normalizeProviderName,
  normalizeVaccineName,
  type FieldErrors,
} from '@pawcare/core';
import { insertCareRecord, ownerToday, readActivePet } from '../care-records/care-record';
import { recordChange } from '../change-log';
import type { Database } from '../database';
import type { DataDeps } from '../deps';
import { notFound, validationFailed } from '../errors';
import { UUID } from '../paging';
import type { SqlConnection } from '../sql';
import type { CreateVaccinationInput, Vaccination } from '../types';
import { parseCreateVaccinationInput } from './vaccine-input';

export interface VaccineRepository {
  /** Records an owner-entered vaccination (and its due item) in one write. */
  create(input: CreateVaccinationInput): Promise<Vaccination>;
  /** Any status, archived pets included. Unknown or another owner's → `NOT_FOUND`. */
  get(id: string): Promise<Vaccination>;
}

interface VaccinationRow {
  id: string;
  pet_id: string;
  status: Vaccination['status'];
  provenance: Vaccination['provenance'];
  void_reason: string | null;
  voided_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  vaccine_name: string;
  administered_on: string;
  provider_name: string | null;
  batch_label: string | null;
  due_id: string | null;
  due_on: string | null;
}

const SELECT_VACCINATION = `
  SELECT r.id, r.pet_id, r.status, r.provenance, r.void_reason, r.voided_at, r.version,
         r.created_at, r.updated_at, v.vaccine_name, v.administered_on, v.provider_name,
         v.batch_label, d.id AS due_id, d.due_on
  FROM care_records r
  JOIN vaccinations v ON v.owner_id = r.owner_id AND v.record_id = r.id
  LEFT JOIN vaccine_due_items d ON d.owner_id = v.owner_id AND d.vaccination_id = v.record_id`;

/** `today` is the owner's local date: a due date before it is Overdue (derived, never stored). */
function toVaccination(row: VaccinationRow, today: string): Vaccination {
  return {
    id: row.id,
    petId: row.pet_id,
    vaccineName: row.vaccine_name,
    administeredOn: row.administered_on,
    providerName: row.provider_name,
    batchLabel: row.batch_label,
    nextDue:
      row.due_id === null || row.due_on === null
        ? null
        : { id: row.due_id, dueOn: row.due_on, overdue: row.due_on < today },
    status: row.status,
    provenance: row.provenance,
    voidReason: row.void_reason,
    voidedAt: row.voided_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface VaccinationFields {
  vaccineName: string;
  administeredOn: string;
  providerName: string | null;
  batchLabel: string | null;
  nextDueOn: string | null;
}

/** Applies every field rule; throws one VALIDATION_FAILED listing all failures. */
function normalizeVaccination(dto: CreateVaccinationInput, today: string): VaccinationFields {
  const errors: FieldErrors = {};
  const take = <T>(field: string, result: T | { error: string }): T => {
    if (isRuleError(result)) {
      errors[field] = [result.error];
      return undefined as T;
    }
    return result as T;
  };
  const administeredOn = take<string>(
    'administeredOn',
    checkVaccinationDate(dto.administeredOn, today),
  );
  const fields: VaccinationFields = {
    vaccineName: take('vaccineName', normalizeVaccineName(dto.vaccineName)),
    administeredOn,
    providerName:
      dto.providerName === undefined
        ? null
        : take('providerName', normalizeProviderName(dto.providerName)),
    batchLabel:
      dto.batchLabel === undefined ? null : take('batchLabel', normalizeBatchLabel(dto.batchLabel)),
    // The due date is compared with the administration date, so only once that one is valid.
    nextDueOn:
      dto.nextDueOn === undefined || administeredOn === undefined
        ? null
        : take('nextDueOn', checkNextDueDate(dto.nextDueOn, administeredOn)),
  };
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return fields;
}

async function readVaccination(c: SqlConnection, ownerId: string, id: string) {
  return c.get<VaccinationRow>(`${SELECT_VACCINATION} WHERE r.owner_id = ? AND r.id = ?`, [
    ownerId,
    id,
  ]);
}

export function createVaccineRepository(
  db: Database,
  deps: DataDeps,
  ownerId: string,
): VaccineRepository {
  return {
    async create(rawInput) {
      const dto = parseCreateVaccinationInput(rawInput);
      return db.write(
        ['care_records', 'vaccinations', 'vaccine_due_items', 'change_log'],
        async (c) => {
          const pet = await readActivePet(c, ownerId, dto.petId);
          if (!pet) throw notFound();
          const today = await ownerToday(c, ownerId, deps);
          const input = normalizeVaccination(dto, today);

          const id = deps.newId();
          const at = deps.now().toISOString();
          await insertCareRecord(c, {
            id,
            ownerId,
            petId: pet.id,
            kind: 'VACCINE',
            occurrenceDate: input.administeredOn,
            at,
          });
          await c.run(
            `INSERT INTO vaccinations (record_id, owner_id, pet_id, vaccine_name, administered_on, provider_name, batch_label)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              ownerId,
              pet.id,
              input.vaccineName,
              input.administeredOn,
              input.providerName,
              input.batchLabel,
            ],
          );
          if (input.nextDueOn !== null) {
            await c.run(
              `INSERT INTO vaccine_due_items (id, owner_id, pet_id, vaccination_id, due_on, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [deps.newId(), ownerId, pet.id, id, input.nextDueOn, at, at],
            );
          }
          await recordChange(c, deps, {
            ownerId,
            entityType: 'care_record',
            entityId: id,
            entityVersion: 1,
            action: 'vaccination.created',
            fields: [
              'petId',
              'vaccineName',
              'administeredOn',
              ...(input.providerName === null ? [] : ['providerName']),
              ...(input.batchLabel === null ? [] : ['batchLabel']),
              ...(input.nextDueOn === null ? [] : ['nextDueOn']),
            ],
          });
          return toVaccination((await readVaccination(c, ownerId, id))!, today);
        },
      );
    },

    async get(id) {
      const found = UUID.test(id)
        ? await db.read(async (c) => {
            const row = await readVaccination(c, ownerId, id);
            return row && toVaccination(row, await ownerToday(c, ownerId, deps));
          })
        : undefined;
      if (!found) throw notFound();
      return found;
    },
  };
}
