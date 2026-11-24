import {
  PAGE_LIMIT,
  checkPastOrToday,
  isRuleError,
  localDate,
  normalizeMicrochip,
  normalizeOptionalText,
  normalizePetName,
  toGrams,
  type FieldErrors,
} from '@pawcare/core';
import { recordChange } from '../change-log';
import type { Database } from '../database';
import type { SqlConnection } from '../sql';
import type { DataDeps } from '../deps';
import { notFound, profileSetupRequired, validationFailed } from '../errors';
import type { CreatePetInput, Pet, PetPage } from '../types';
import { parseCreatePetInput } from './pet-input';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SETUP_MESSAGE = 'Finish setting up your profile before adding a pet.';
const PAGE_SIZE_MESSAGE = 'Choose a page size of 1–100.';
const CURSOR_MESSAGE = 'Use the nextCursor from the previous page.';

export interface PetRepository {
  create(input: CreatePetInput): Promise<Pet>;
  list(query?: { limit?: number; cursor?: string }): Promise<PetPage>;
  get(id: string): Promise<Pet>;
  /** The selected pet if active; else the oldest active pet; `null` with none. Never writes. */
  selected(): Promise<Pet | null>;
  /** Stores the selection. Unknown, malformed or archived pets are `NOT_FOUND`. */
  select(id: string): Promise<Pet>;
}

interface PetRow {
  id: string;
  name: string;
  species: Pet['species'];
  species_other: string | null;
  breed: string | null;
  sex: Pet['sex'];
  birth_date: string | null;
  birth_date_estimated: number;
  current_weight_g: number | null;
  weight_measured_on: string | null;
  microchip: string | null;
  version: number;
  created_at: string;
  archived_at: string | null;
}

/** Validated pet fields, before defaults. The weight is kilograms, as in the API. */
interface PetFields {
  name: string;
  species: Pet['species'];
  speciesOther?: string;
  breed?: string;
  sex?: Pet['sex'];
  birthDate?: string;
  birthDateEstimated?: boolean;
  currentWeightKg?: number;
  weightMeasuredOn?: string;
  microchip?: string;
}

function toPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    speciesOther: row.species_other,
    breed: row.breed,
    sex: row.sex,
    birthDate: row.birth_date,
    birthDateEstimated: row.birth_date_estimated === 1,
    currentWeightKg: row.current_weight_g === null ? null : row.current_weight_g / 1000,
    weightMeasuredOn: row.weight_measured_on,
    microchip: row.microchip,
    version: row.version,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

/** Applies every field rule; throws one error listing all failures. */
function normalizePet(dto: CreatePetInput, today: string): PetFields {
  const errors: FieldErrors = {};
  const input: PetFields = { name: '', species: dto.species };
  const take = <K extends keyof PetFields>(field: K, result: PetFields[K] | { error: string }) => {
    if (isRuleError(result)) errors[field] = [result.error];
    else input[field] = result as PetFields[K];
  };

  take('name', normalizePetName(dto.name));
  if (dto.species === 'OTHER') {
    take(
      'speciesOther',
      normalizeOptionalText(
        dto.speciesOther ?? '',
        100,
        'Describe the species in 1–100 characters.',
      ),
    );
  } else if (dto.speciesOther !== undefined) {
    errors.speciesOther = ['Only add a description when the species is Other.'];
  }
  if (dto.breed !== undefined) {
    take('breed', normalizeOptionalText(dto.breed, 100, 'Enter a breed of 1–100 characters.'));
  }
  if (dto.sex !== undefined) input.sex = dto.sex;
  if (dto.birthDate !== undefined) {
    take(
      'birthDate',
      checkPastOrToday(dto.birthDate, today, "The birth date can't be in the future."),
    );
  }
  if (dto.birthDateEstimated !== undefined) {
    if (dto.birthDateEstimated && dto.birthDate === undefined) {
      errors.birthDateEstimated = ['Add a birth date to mark it as estimated.'];
    } else {
      input.birthDateEstimated = dto.birthDateEstimated;
    }
  }
  if (dto.weight !== undefined) {
    const grams = toGrams(dto.weight.value, dto.weight.unit);
    if (isRuleError(grams)) errors.weight = [grams.error];
    else input.currentWeightKg = grams / 1000;
  }
  if (dto.weightMeasuredOn !== undefined) {
    if (dto.weight === undefined) {
      errors.weightMeasuredOn = ['Add a weight for this measurement date.'];
    } else {
      take(
        'weightMeasuredOn',
        checkPastOrToday(
          dto.weightMeasuredOn,
          today,
          "The measurement date can't be in the future.",
        ),
      );
    }
  }
  if (dto.microchip !== undefined) take('microchip', normalizeMicrochip(dto.microchip));
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return input;
}

async function readActivePet(
  c: SqlConnection,
  ownerId: string,
  id: string,
): Promise<PetRow | undefined> {
  if (!UUID.test(id)) return undefined;
  return c.get<PetRow>('SELECT * FROM pets WHERE owner_id = ? AND id = ? AND archived_at IS NULL', [
    ownerId,
    id,
  ]);
}

async function storeSelection(c: SqlConnection, ownerId: string, petId: string, at: string) {
  await c.run(
    `INSERT INTO pet_selection (owner_id, pet_id, selected_at) VALUES (?, ?, ?)
     ON CONFLICT (owner_id) DO UPDATE SET pet_id = excluded.pet_id, selected_at = excluded.selected_at`,
    [ownerId, petId, at],
  );
}

function parsePageQuery(query: { limit?: number; cursor?: string }) {
  const errors: FieldErrors = {};
  const { limit = PAGE_LIMIT.default, cursor } = query;
  if (!Number.isInteger(limit) || limit < PAGE_LIMIT.min || limit > PAGE_LIMIT.max) {
    errors.limit = [PAGE_SIZE_MESSAGE];
  }
  if (cursor !== undefined && !(typeof cursor === 'string' && UUID.test(cursor))) {
    errors.cursor = [CURSOR_MESSAGE];
  }
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return { limit, cursor };
}

/** Every query is scoped to `ownerId`, the phone's owner from `ensureOwner`. */
export function createPetRepository(db: Database, deps: DataDeps, ownerId: string): PetRepository {
  return {
    async create(rawInput) {
      return db.write(['pets', 'pet_selection', 'change_log'], async (c) => {
        const owner = await c.get<{
          id: string;
          time_zone: string;
          profile_completed_at: string | null;
        }>('SELECT id, time_zone, profile_completed_at FROM owners WHERE id = ?', [ownerId]);
        if (!owner || owner.profile_completed_at === null) {
          throw profileSetupRequired(SETUP_MESSAGE);
        }
        const dto = parseCreatePetInput(rawInput);
        const today = localDate(owner.time_zone, deps.now());
        const input = normalizePet(dto, today);
        const id = deps.newId();
        const at = deps.now().toISOString();
        const measuredOn =
          input.currentWeightKg === undefined ? null : (input.weightMeasuredOn ?? today);
        await c.run(
          `INSERT INTO pets (id, owner_id, name, species, species_other, breed, sex, birth_date,
             birth_date_estimated, current_weight_g, weight_measured_on, microchip,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            owner.id,
            input.name,
            input.species,
            input.speciesOther ?? null,
            input.breed ?? null,
            input.sex ?? 'UNKNOWN',
            input.birthDate ?? null,
            input.birthDateEstimated ? 1 : 0,
            input.currentWeightKg === undefined ? null : Math.round(input.currentWeightKg * 1000),
            measuredOn,
            input.microchip ?? null,
            at,
            at,
          ],
        );
        await recordChange(c, deps, {
          ownerId: owner.id,
          entityType: 'pet',
          entityId: id,
          entityVersion: 1,
          action: 'pet.created',
          fields: Object.keys(input),
        });
        await storeSelection(c, ownerId, id, at);
        const row = await c.get<PetRow>('SELECT * FROM pets WHERE owner_id = ? AND id = ?', [
          ownerId,
          id,
        ]);
        return toPet(row!);
      });
    },

    async list(query = {}) {
      const { limit, cursor } = parsePageQuery(query);
      const rows = await db.read((c) =>
        c.all<PetRow>(
          `SELECT * FROM pets WHERE owner_id = ? AND archived_at IS NULL AND (? IS NULL OR id > ?)
           ORDER BY id LIMIT ?`,
          [ownerId, cursor ?? null, cursor ?? null, limit + 1],
        ),
      );
      const page = rows.slice(0, limit);
      return {
        data: page.map(toPet),
        nextCursor: rows.length > limit ? page[page.length - 1].id : null,
      };
    },

    async selected() {
      const row = await db.read(
        async (c) =>
          (await c.get<PetRow>(
            `SELECT p.* FROM pet_selection s
             JOIN pets p ON p.owner_id = s.owner_id AND p.id = s.pet_id
             WHERE s.owner_id = ? AND p.archived_at IS NULL`,
            [ownerId],
          )) ??
          (await c.get<PetRow>(
            'SELECT * FROM pets WHERE owner_id = ? AND archived_at IS NULL ORDER BY id LIMIT 1',
            [ownerId],
          )),
      );
      return row ? toPet(row) : null;
    },

    async select(id) {
      return db.write(['pet_selection'], async (c) => {
        const row = await readActivePet(c, ownerId, id);
        if (!row) throw notFound();
        await storeSelection(c, ownerId, id, deps.now().toISOString());
        return toPet(row);
      });
    },

    async get(id) {
      const row = UUID.test(id)
        ? await db.read((c) =>
            c.get<PetRow>('SELECT * FROM pets WHERE owner_id = ? AND id = ?', [ownerId, id]),
          )
        : undefined;
      if (!row) throw notFound();
      return toPet(row);
    },
  };
}
