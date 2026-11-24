import { MEDICAL_EVENT_TYPES, type FieldErrors } from '@pawcare/core';
import { validationFailed } from '../errors';
import { CHOOSE_EVENT_TYPE, INVALID, REQUIRED, asRecord, rejectUnknown } from '../shape';
import type { CreateMedicalEventInput } from '../types';

const ALLOWED = [
  'petId',
  'eventType',
  'title',
  'occurrenceDate',
  'notes',
  'providerName',
  'confirmBeforeBirth',
] as const;

/** Checks the shape of a create (types, allowed keys); the field rules run afterwards. */
export function parseCreateMedicalEventInput(input: unknown): CreateMedicalEventInput {
  const record = asRecord(input);
  const errors: FieldErrors = {};
  rejectUnknown(record, ALLOWED, errors);

  for (const field of ['petId', 'title', 'occurrenceDate']) {
    if (record[field] === undefined) errors[field] = [REQUIRED];
    else if (typeof record[field] !== 'string') errors[field] = [INVALID];
  }
  if (!(MEDICAL_EVENT_TYPES as readonly unknown[]).includes(record.eventType)) {
    errors.eventType = [CHOOSE_EVENT_TYPE];
  }
  for (const field of ['notes', 'providerName']) {
    if (record[field] !== undefined && typeof record[field] !== 'string') errors[field] = [INVALID];
  }
  if (record.confirmBeforeBirth !== undefined && typeof record.confirmBeforeBirth !== 'boolean') {
    errors.confirmBeforeBirth = [INVALID];
  }
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return record as unknown as CreateMedicalEventInput;
}
