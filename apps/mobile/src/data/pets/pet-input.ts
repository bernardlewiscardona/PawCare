import { MAX_INT4, SEXES, SPECIES, WEIGHT_UNITS, type FieldErrors } from '@pawcare/core';
import { validationFailed } from '../errors';
import {
  CHOOSE_SEX,
  CHOOSE_SPECIES,
  CHOOSE_UNIT,
  INVALID,
  REQUIRED,
  VERSION,
  WEIGHT_NUMBER,
  asRecord,
  rejectUnknown,
} from '../shape';
import type { CreatePetInput, UpdatePetInput } from '../types';

const FIELDS = [
  'name',
  'species',
  'speciesOther',
  'breed',
  'sex',
  'birthDate',
  'birthDateEstimated',
  'weight',
  'weightMeasuredOn',
  'microchip',
] as const;
const OPTIONAL_STRINGS = ['speciesOther', 'breed', 'birthDate', 'weightMeasuredOn', 'microchip'];

const isOneOf = (list: readonly unknown[], value: unknown) => list.includes(value);

/**
 * Type checks shared by create and update for the fields other than `name` and `species`.
 * `nullable` lets an update send `null` to clear the optional strings and the weight.
 */
function checkOptionalFields(
  record: Record<string, unknown>,
  errors: FieldErrors,
  nullable: boolean,
): void {
  const absent = (value: unknown) => value === undefined || (nullable && value === null);
  if (record.sex !== undefined && !isOneOf(SEXES, record.sex)) errors.sex = [CHOOSE_SEX];
  for (const field of OPTIONAL_STRINGS) {
    if (!absent(record[field]) && typeof record[field] !== 'string') errors[field] = [INVALID];
  }
  if (record.birthDateEstimated !== undefined && typeof record.birthDateEstimated !== 'boolean') {
    errors.birthDateEstimated = [INVALID];
  }
  if (!absent(record.weight)) {
    const weight = asRecord(record.weight);
    const weightErrors: string[] = [];
    if (typeof weight.value !== 'number' || !Number.isFinite(weight.value)) {
      weightErrors.push(WEIGHT_NUMBER);
    }
    if (!isOneOf(WEIGHT_UNITS, weight.unit)) weightErrors.push(CHOOSE_UNIT);
    if (weightErrors.length > 0) errors.weight = weightErrors;
  }
}

/** Checks the shape of a create (types, allowed keys); the field rules run afterwards. */
export function parseCreatePetInput(input: unknown): CreatePetInput {
  const record = asRecord(input);
  const errors: FieldErrors = {};
  rejectUnknown(record, FIELDS, errors);

  if (record.name === undefined) errors.name = [REQUIRED];
  else if (typeof record.name !== 'string') errors.name = [INVALID];
  if (!isOneOf(SPECIES, record.species)) errors.species = [CHOOSE_SPECIES];
  checkOptionalFields(record, errors, false);
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return record as unknown as CreatePetInput;
}

/**
 * Checks the shape of an update. `null` clears an optional field; `name`, `species`, `sex` and
 * `birthDateEstimated` can't be null. A string `id` that isn't a UUID is left to the repository,
 * which answers it with `NOT_FOUND`.
 */
export function parseUpdatePetInput(input: unknown): UpdatePetInput {
  const record = asRecord(input);
  const errors: FieldErrors = {};
  rejectUnknown(record, ['id', 'version', ...FIELDS], errors);

  if (typeof record.id !== 'string') errors.id = [INVALID];
  const { version } = record;
  if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > MAX_INT4) {
    errors.version = [VERSION];
  }
  if (record.name !== undefined && typeof record.name !== 'string') errors.name = [INVALID];
  if (record.species !== undefined && !isOneOf(SPECIES, record.species)) {
    errors.species = [CHOOSE_SPECIES];
  }
  checkOptionalFields(record, errors, true);
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return record as unknown as UpdatePetInput;
}
