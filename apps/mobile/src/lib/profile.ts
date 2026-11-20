/** Owner profile helpers (PF-01, RM-01). */

/** IANA zones offered in the picker. A full list arrives with the API's zone catalogue. */
export const TIME_ZONES = [
  'Asia/Manila',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Europe/London',
  'America/Los_Angeles',
] as const;

const OFFSETS: Record<string, string> = {
  'Asia/Manila': 'GMT+8',
  'Asia/Tokyo': 'GMT+9',
  'Asia/Singapore': 'GMT+8',
  'Australia/Sydney': 'GMT+11',
  'Europe/London': 'GMT+0',
  'America/Los_Angeles': 'GMT−8',
};

/** "Asia/Manila (GMT+8)" */
export function zoneLabel(zone: string): string {
  return OFFSETS[zone] ? `${zone} (${OFFSETS[zone]})` : zone;
}

/** City part of a zone: "Asia/Tokyo" → "Tokyo". */
export function zoneCity(zone: string): string {
  return zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;
}

/**
 * Optional PH mobile number after the +63 prefix: 10 digits starting with 9. Spaces allowed.
 * Returns an error message, or undefined when valid or empty.
 */
export function phoneError(value: string): string | undefined {
  const digits = value.replace(/\s/g, '');
  if (!digits) return undefined;
  return /^9\d{9}$/.test(digits) ? undefined : 'Enter a 10-digit mobile number, like 917 123 4567.';
}
