import type { RuleError } from './errors.js';
import { checkPastOrToday, normalizeOptionalText } from './pet-rules.js';

const FUTURE_EVENT = "A medical event can't be in the future. Add planned visits in Appointments.";

/** Medical event title (MR-01): 1–150 trimmed code points. */
export function normalizeMedicalTitle(value: string): string | RuleError {
  return normalizeOptionalText(value, 150, 'Enter a title of 1–150 characters.');
}

/** Optional text: blank becomes `null`; otherwise 1–max trimmed code points. */
function optionalText(value: string, max: number, error: string): string | null | RuleError {
  return value.trim() === '' ? null : normalizeOptionalText(value, max, error);
}

/** Medical event notes (MR-01): up to 5,000 code points; blank is stored as `null`. */
export function normalizeMedicalNotes(value: string): string | null | RuleError {
  return optionalText(value, 5000, 'Keep notes to 5,000 characters.');
}

/** Owner-entered provider text (MR-01): up to 150 code points; blank is stored as `null`. */
export function normalizeProviderName(value: string): string | null | RuleError {
  return optionalText(value, 150, 'Enter a provider name of up to 150 characters.');
}

/**
 * A medical event is history: a real date from 1900 up to the owner's local `today`. Planned
 * visits belong in the appointment diary, and the error says so.
 */
export function checkMedicalEventDate(value: string, today: string): string | RuleError {
  return checkPastOrToday(value, today, FUTURE_EVENT);
}
