import type { RuleError } from '../common/errors/rule-error.js';

const KG_PER_LB = 0.45359237;
const WEIGHT_ERROR: RuleError = { error: 'Enter a weight above 0 and up to 1,000 kg.' };
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

/** A real YYYY-MM-DD calendar date no later than `today` (the owner's local date). */
export function checkPastOrToday(
  value: string,
  today: string,
  futureError: string,
): string | RuleError {
  const match = ISO_DATE.exec(value);
  if (!match) return DATE_ERROR;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) return DATE_ERROR;
  return value <= today ? value : { error: futureError };
}

/**
 * Body weight in kilograms, rounded to the gram (the column holds 3 decimals). Only body weight
 * is ever converted (decision 23 Nov 2026); doses and clinical units never are.
 */
export function toKilograms(value: number, unit: 'KG' | 'LB'): number | RuleError {
  const kilograms = Math.round(value * (unit === 'LB' ? KG_PER_LB : 1) * 1000) / 1000;
  return kilograms > 0 && kilograms <= 1000 ? kilograms : WEIGHT_ERROR;
}
