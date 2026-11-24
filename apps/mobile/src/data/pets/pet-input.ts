import { SEXES, SPECIES, WEIGHT_UNITS, type FieldErrors } from '@pawcare/core';
import { validationFailed } from '../errors';
import {
  CHOOSE_SEX,
  CHOOSE_SPECIES,
  CHOOSE_UNIT,
  INVALID,
  REQUIRED,
  WEIGHT_NUMBER,
  asRecord,
  rejectUnknown,
} from '../shape';
import type { CreatePetInput } from '../types';

const ALLOWED = [
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

/** Checks the shape of a create (types, allowed keys); the field rules run afterwards. */
export function parseCreatePetInput(input: unknown): CreatePetInput {
  const record = asRecord(input);
  const errors: FieldErrors = {};
  rejectUnknown(record, ALLOWED, errors);

  if (record.name === undefined) errors.name = [REQUIRED];
  else if (typeof record.name !== 'string') errors.name = [INVALID];
  if (!isOneOf(SPECIES, record.species)) errors.species = [CHOOSE_SPECIES];
  if (record.sex !== undefined && !isOneOf(SEXES, record.sex)) errors.sex = [CHOOSE_SEX];
  for (const field of OPTIONAL_STRINGS) {
    if (record[field] !== undefined && typeof record[field] !== 'string') errors[field] = [INVALID];
  }
  if (record.birthDateEstimated !== undefined && typeof record.birthDateEstimated !== 'boolean') {
    errors.birthDateEstimated = [INVALID];
  }
  if (record.weight !== undefined) {
    const weight = asRecord(record.weight);
    const weightErrors: string[] = [];
    if (typeof weight.value !== 'number' || !Number.isFinite(weight.value)) {
      weightErrors.push(WEIGHT_NUMBER);
    }
    if (!isOneOf(WEIGHT_UNITS, weight.unit)) weightErrors.push(CHOOSE_UNIT);
    if (weightErrors.length > 0) errors.weight = weightErrors;
  }
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return record as unknown as CreatePetInput;
}
