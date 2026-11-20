/**
 * Display formatting for PawCare's two kinds of time:
 * - date-only facts ("YYYY-MM-DD": birth dates, vaccine dates, due dates) are calendar values and
 *   are never converted through UTC or the device zone;
 * - local wall-clock times ("HH:mm") already resolved in the relevant zone (appointment zone or
 *   owner zone) by the API.
 * Copy is English-only in v1.
 */

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type CalendarDate = { year: number; month: number; day: number };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^(\d{2}):(\d{2})$/;

/** Parses "YYYY-MM-DD" as a calendar date. Throws on anything else, including impossible dates. */
export function parseDateOnly(value: string): CalendarDate {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${value}"`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error(`"${value}" is not a real calendar date`);
  }
  return { year, month, day };
}

/** Whole days since the epoch for a calendar date. UTC is used only as a neutral day counter. */
function dayNumber({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function weekday(date: CalendarDate): number {
  return new Date(dayNumber(date) * 86_400_000).getUTCDay();
}

/** "Thu, 19 Nov" */
export function formatShortDate(value: string): string {
  const date = parseDateOnly(value);
  return `${WEEKDAYS_SHORT[weekday(date)]}, ${date.day} ${MONTHS_SHORT[date.month - 1]}`;
}

/** "Tuesday, 10 November" */
export function formatLongDate(value: string): string {
  const date = parseDateOnly(value);
  return `${WEEKDAYS_LONG[weekday(date)]}, ${date.day} ${MONTHS_LONG[date.month - 1]}`;
}

/** Day and month parts for the timeline's date column: { day: "05", month: "Nov" }. */
export function formatDayMonth(value: string): { day: string; month: string } {
  const date = parseDateOnly(value);
  return { day: String(date.day).padStart(2, '0'), month: MONTHS_SHORT[date.month - 1] };
}

/** "5–15 Nov" within a month, otherwise "28 Oct – 3 Nov" (or with years when they differ). */
export function formatDateRange(start: string, end: string): string {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${MONTHS_SHORT[b.month - 1]}`;
  }
  if (a.year === b.year) {
    return `${a.day} ${MONTHS_SHORT[a.month - 1]} – ${b.day} ${MONTHS_SHORT[b.month - 1]}`;
  }
  return `${a.day} ${MONTHS_SHORT[a.month - 1]} ${a.year} – ${b.day} ${MONTHS_SHORT[b.month - 1]} ${b.year}`;
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(parseDateOnly(to)) - dayNumber(parseDateOnly(from));
}

/** "today", "tomorrow", "in 2 days", "yesterday", "8 days ago". */
export function formatRelativeDays(target: string, today: string): string {
  const diff = daysBetween(today, target);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

/** Splits "20:00" into { time: "8:00", period: "PM" } for the dose time column. */
export function splitTime12h(value: string): { time: string; period: 'AM' | 'PM' } {
  const match = LOCAL_TIME.exec(value);
  if (!match) throw new Error(`Expected an HH:mm time, got "${value}"`);
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || Number(minutes) > 59) throw new Error(`"${value}" is not a valid time`);
  const period = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return { time: `${hour12}:${minutes}`, period };
}

/** "10:30 AM" */
export function formatTime12h(value: string): string {
  const { time, period } = splitTime12h(value);
  return `${time} ${period}`;
}

/** "19 Oct 2026" */
export function formatDate(value: string): string {
  const date = parseDateOnly(value);
  return `${date.day} ${MONTHS_SHORT[date.month - 1]} ${date.year}`;
}

/** "19 Oct" */
export function formatDayMonthShort(value: string): string {
  const date = parseDateOnly(value);
  return `${date.day} ${MONTHS_SHORT[date.month - 1]}`;
}

/** "Thu, 19 Nov 2026" */
export function formatShortDateYear(value: string): string {
  return `${formatShortDate(value)} ${parseDateOnly(value).year}`;
}

/** "5–15 Nov 2026", "24 Sep – 1 Oct 2026" or across years with both years. */
export function formatDateRangeYear(start: string, end: string): string {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (a.year !== b.year) return formatDateRange(start, end);
  return `${formatDateRange(start, end)} ${b.year}`;
}

/** "10:30–11:00 AM", or "11:30 AM–12:30 PM" when the period changes. */
export function formatTimeRange(start: string, end: string): string {
  const a = splitTime12h(start);
  const b = splitTime12h(end);
  return a.period === b.period
    ? `${a.time}–${b.time} ${b.period}`
    : `${a.time} ${a.period}–${b.time} ${b.period}`;
}

/**
 * Display age from a date-only birth date. Estimated births only show whole years ("about 4
 * yrs"); unknown birth dates show "Unknown" (PF-02).
 */
export function formatAge(
  birthDate: string | undefined,
  estimated: boolean,
  today: string,
): string {
  if (!birthDate) return 'Unknown';
  const b = parseDateOnly(birthDate);
  const t = parseDateOnly(today);
  if (estimated) {
    const years = t.year - b.year;
    if (years <= 0) return 'under 1 yr';
    return `about ${years} ${years === 1 ? 'yr' : 'yrs'}`;
  }
  const months = (t.year - b.year) * 12 + (t.month - b.month) - (t.day < b.day ? 1 : 0);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  const yLabel = `${y} ${y === 1 ? 'yr' : 'yrs'}`;
  return m === 0 ? yLabel : `${yLabel} ${m} mo`;
}

const DISCRETE = new Set(['piece', 'tablet', 'capsule', 'sachet']);

/** Units counted in whole numbers (IN-01). */
export function isDiscreteUnit(unit: string): boolean {
  return DISCRETE.has(unit);
}

/** "tablet"/"tablets" for discrete units; g, kg and ml never pluralise. */
export function unitLabel(unit: string, quantity: number): string {
  return DISCRETE.has(unit) && Math.abs(quantity) !== 1 ? `${unit}s` : unit;
}

/** Up to three decimals, trailing zeros trimmed — values are shown as stored, never converted. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** "9 tablets", "1 piece", "3.2 kg", "250 ml" */
export function formatQuantity(quantity: number, unit: string): string {
  return `${formatNumber(quantity)} ${unitLabel(unit, quantity)}`;
}

/** "+14 tablets", "−1 tablet" (true minus sign), "0 tablets" */
export function formatSignedQuantity(quantity: number, unit: string): string {
  const sign = quantity > 0 ? '+' : quantity < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(quantity))} ${unitLabel(unit, quantity)}`;
}

/** "10 Nov, 8:02 AM" or "5 Nov" for ledger rows. */
export function formatWhen(date: string, time?: string): string {
  return time ? `${formatDayMonthShort(date)}, ${formatTime12h(time)}` : formatDayMonthShort(date);
}

/**
 * Parses a typed quantity in an item's unit (IN-01): positive (or zero when allowed), at most
 * three decimals, whole numbers for discrete units. Excess precision is rejected, never rounded.
 */
export function parseQuantity(
  text: string,
  unit: string,
  { allowZero = false }: { allowZero?: boolean } = {},
): { value?: number; error?: string } {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return { error: 'Enter a quantity.' };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { error: 'Enter a number, like 2 or 2.5.' };
  const value = Number(trimmed);
  if (!allowZero && value <= 0) return { error: 'Enter a quantity above 0.' };
  if (isDiscreteUnit(unit) && !Number.isInteger(value)) {
    const plural = `${unit}s`;
    return { error: `${plural[0].toUpperCase()}${plural.slice(1)} are counted in whole numbers.` };
  }
  if ((trimmed.split('.')[1] ?? '').length > 3) return { error: 'Use up to 3 decimal places.' };
  return { value };
}
