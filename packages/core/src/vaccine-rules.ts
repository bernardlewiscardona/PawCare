import { isRuleError, type RuleError } from './errors.js';
import { checkDate, checkPastOrToday, normalizeOptionalText } from './pet-rules.js';

/** Vaccine name as the owner wrote it (VC-01): 1–150 trimmed code points; no catalogue. */
export function normalizeVaccineName(value: string): string | RuleError {
  return normalizeOptionalText(value, 150, 'Enter a vaccine name of 1–150 characters.');
}

/** Batch or lot label: up to 100 code points; blank is stored as `null`. */
export function normalizeBatchLabel(value: string): string | null | RuleError {
  return value.trim() === ''
    ? null
    : normalizeOptionalText(value, 100, 'Enter a batch of up to 100 characters.');
}

/** The administration date: a real date from 1900, not after the owner's local `today`. */
export function checkVaccinationDate(value: string, today: string): string | RuleError {
  return checkPastOrToday(value, today, "The vaccination date can't be in the future.");
}

/**
 * The documented next due date: a real date, not before the administration date. It may already
 * be past (shown as Overdue); PawCare never infers one.
 */
export function checkNextDueDate(value: string, administeredOn: string): string | RuleError {
  const date = checkDate(value);
  if (isRuleError(date)) return date;
  return date >= administeredOn
    ? date
    : { error: "The next due date can't be before the vaccination date." };
}
