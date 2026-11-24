import { MAX_INT4, WEIGHT_UNITS, type FieldErrors } from '@pawcare/core';
import { validationFailed } from '../errors';
import { CHOOSE_UNIT, INVALID, VERSION, asRecord, rejectUnknown } from '../shape';
import type { UpdateOwnerInput } from '../types';

const ALLOWED = ['version', 'displayName', 'timeZone', 'phone', 'weightUnit'] as const;

/** Checks the shape of an update (types, allowed keys); the field rules run afterwards. */
export function parseUpdateOwnerInput(input: unknown): UpdateOwnerInput {
  const record = asRecord(input);
  const errors: FieldErrors = {};
  rejectUnknown(record, ALLOWED, errors);

  const { version, displayName, timeZone, phone, weightUnit } = record;
  if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > MAX_INT4) {
    errors.version = [VERSION];
  }
  const invalid = (field: string) => {
    errors[field] = [INVALID];
  };
  if (displayName !== undefined && typeof displayName !== 'string') invalid('displayName');
  if (timeZone !== undefined && typeof timeZone !== 'string') invalid('timeZone');
  if (phone !== undefined && phone !== null && typeof phone !== 'string') invalid('phone');
  if (weightUnit !== undefined && !(WEIGHT_UNITS as readonly unknown[]).includes(weightUnit)) {
    errors.weightUnit = [CHOOSE_UNIT];
  }
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return record as unknown as UpdateOwnerInput;
}
