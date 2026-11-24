import type { FieldErrors } from '@pawcare/core';

export const NOT_ALLOWED = "This field isn't allowed.";
export const REQUIRED = 'This field is required.';
export const INVALID = 'Enter a valid value.';
export const CHOOSE_SPECIES = 'Choose a species.';
export const CHOOSE_SEX = 'Choose a sex.';
export const CHOOSE_UNIT = 'Choose kg or lb.';
export const WEIGHT_NUMBER = 'Enter a weight as a number.';
export const VERSION = 'Send the version you last read.';

/** A non-object input is treated as empty, so every required field then reports its own error. */
export function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function rejectUnknown(
  record: Record<string, unknown>,
  allowed: readonly string[],
  errors: FieldErrors,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) errors[key] = [NOT_ALLOWED];
  }
}
