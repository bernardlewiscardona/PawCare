import type { FieldErrors } from '@pawcare/core';
import { validationFailed } from '../errors';
import { INVALID, REQUIRED, asRecord, rejectUnknown } from '../shape';
import type { CreateVaccinationInput } from '../types';

const ALLOWED = [
  'petId',
  'vaccineName',
  'administeredOn',
  'providerName',
  'batchLabel',
  'nextDueOn',
  'confirmSimilar',
  'confirmBeforeBirth',
] as const;

/** Checks the shape of a create (types, allowed keys); the field rules run afterwards. */
export function parseCreateVaccinationInput(input: unknown): CreateVaccinationInput {
  const record = asRecord(input);
  const errors: FieldErrors = {};
  rejectUnknown(record, ALLOWED, errors);

  for (const field of ['petId', 'vaccineName', 'administeredOn']) {
    if (record[field] === undefined) errors[field] = [REQUIRED];
    else if (typeof record[field] !== 'string') errors[field] = [INVALID];
  }
  for (const field of ['providerName', 'batchLabel', 'nextDueOn']) {
    if (record[field] !== undefined && typeof record[field] !== 'string') errors[field] = [INVALID];
  }
  for (const field of ['confirmSimilar', 'confirmBeforeBirth']) {
    if (record[field] !== undefined && typeof record[field] !== 'boolean')
      errors[field] = [INVALID];
  }
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return record as unknown as CreateVaccinationInput;
}
