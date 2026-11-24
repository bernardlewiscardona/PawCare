import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { RuleError } from './errors.js';

const NAME_ERROR: RuleError = { error: 'Enter a name of 1–100 characters.' };
const ZONE_ERROR: RuleError = { error: 'Choose a valid time zone.' };
const PHONE_ERROR: RuleError = {
  error: 'Enter the number with its country code, like +63 917 123 4567.',
};

/** Trimmed display name of 1–100 characters (Unicode code points, matching the DB CHECK). */
export function normalizeDisplayName(value: string): string | RuleError {
  const name = value.trim();
  // Code points, not graphemes: the owners_display_name_check CHECK uses char_length, which
  // counts code points, so the API and the database agree on what fits.
  const length = Array.from(name).length;
  return length >= 1 && length <= 100 ? name : NAME_ERROR;
}

// IANA zones this runtime knows, built on first use. Intl omits "UTC", which new development
// owners start with. Runtimes without Intl.supportedValuesOf (older Hermes) accept any name the
// DateTimeFormat constructor takes that looks like Area/City or is UTC, which rejects "GMT+8".
let timeZones: Set<string> | undefined;

function isKnownZone(value: string): boolean {
  if (typeof Intl.supportedValuesOf === 'function') {
    timeZones ??= new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
    return timeZones.has(value);
  }
  if (!value.includes('/') && value !== 'UTC') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** An IANA time zone name, exactly as written (zone names are case-sensitive). */
export function checkTimeZone(value: string): string | RuleError {
  return isKnownZone(value) ? value : ZONE_ERROR;
}

/** An international phone number stored as E.164, or null to remove it. */
export function normalizePhone(value: string | null): string | null | RuleError {
  if (value === null) return null;
  const input = value.trim();
  if (!input.startsWith('+')) return PHONE_ERROR;
  const phone = parsePhoneNumberFromString(input);
  return phone?.isValid() ? phone.number : PHONE_ERROR;
}
