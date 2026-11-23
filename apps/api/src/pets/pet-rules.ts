import type { RuleError } from '../common/errors/rule-error.js';

const KG_PER_LB = 0.45359237;
const MAX_KG = 1000;
/** Out-of-range message in the unit the owner typed (1,000 kg = 2,204.62 lb). */
const WEIGHT_ERROR: Record<'KG' | 'LB', RuleError> = {
  KG: { error: 'Enter a weight above 0 and up to 1,000 kg.' },
  LB: { error: 'Enter a weight above 0 and up to 2,204.62 lb.' },
};
const GRAM_ERROR: RuleError = { error: 'Enter kilograms with up to 3 decimal places.' };
const EARLIEST_YEAR = 1900;
const DATE_ERROR: RuleError = { error: 'Enter a valid date.' };
const MICROCHIP = /^[A-Za-z0-9]{1,50}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Trimmed text of 1–max characters (code points, matching the DB's char_length CHECKs). */
export function normalizeOptionalText(
  value: string,
  max: number,
  error: string,
): string | RuleError {
  const text = value.trim();
  const length = Array.from(text).length;
  return length >= 1 && length <= max ? text : { error };
}

export function normalizePetName(value: string): string | RuleError {
  return normalizeOptionalText(value, 100, 'Enter a name of 1–100 characters.');
}

export function normalizeMicrochip(value: string): string | RuleError {
  const chip = value.trim();
  return MICROCHIP.test(chip) ? chip : { error: 'Enter 1–50 letters or digits.' };
}

/**
 * A real YYYY-MM-DD calendar date from 1900 up to `today` (the owner's local date). The lower
 * bound catches typos such as 0202 for 2020.
 */
export function checkPastOrToday(
  value: string,
  today: string,
  futureError: string,
): string | RuleError {
  const match = ISO_DATE.exec(value);
  if (!match) return DATE_ERROR;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < EARLIEST_YEAR) return DATE_ERROR;
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) return DATE_ERROR;
  return value <= today ? value : { error: futureError };
}

/**
 * Body weight in kilograms, to the gram (the column holds 3 decimals). Kilograms are taken as
 * typed, so more than 3 decimals is an error; pounds are converted and rounded. The range is
 * checked before rounding. Only body weight is ever converted (decision 23 Nov 2026); doses and
 * clinical units never are.
 */
export function toKilograms(value: number, unit: 'KG' | 'LB'): number | RuleError {
  if (unit === 'KG' && Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6) {
    return GRAM_ERROR;
  }
  const kilograms = value * (unit === 'LB' ? KG_PER_LB : 1);
  const rounded = Math.round(kilograms * 1000) / 1000;
  return kilograms > 0 && kilograms <= MAX_KG && rounded > 0 ? rounded : WEIGHT_ERROR[unit];
}
