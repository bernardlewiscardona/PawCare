import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatDateRange,
  formatDayMonth,
  formatLongDate,
  formatRelativeDays,
  formatShortDate,
  formatTime12h,
  parseDateOnly,
  splitTime12h,
} from './format';

describe('parseDateOnly', () => {
  it('keeps the calendar date exactly as written (no UTC shift)', () => {
    expect(parseDateOnly('2026-11-10')).toEqual({ year: 2026, month: 11, day: 10 });
  });

  it.each(['2026-02-30', '2026-13-01', '10/11/2026', '2026-11-10T00:00:00Z', ''])(
    'rejects %j',
    (value) => {
      expect(() => parseDateOnly(value)).toThrow();
    },
  );

  it('accepts a leap day', () => {
    expect(parseDateOnly('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe('date formatting', () => {
  it('formats short and long dates with the right weekday', () => {
    expect(formatShortDate('2026-11-19')).toBe('Thu, 19 Nov');
    expect(formatShortDate('2026-11-02')).toBe('Mon, 2 Nov');
    expect(formatLongDate('2026-11-10')).toBe('Tuesday, 10 November');
  });

  it('pads the timeline day', () => {
    expect(formatDayMonth('2026-11-05')).toEqual({ day: '05', month: 'Nov' });
  });

  it('formats ranges within and across months and years', () => {
    expect(formatDateRange('2026-11-05', '2026-11-15')).toBe('5–15 Nov');
    expect(formatDateRange('2026-10-28', '2026-11-03')).toBe('28 Oct – 3 Nov');
    expect(formatDateRange('2026-12-30', '2027-01-04')).toBe('30 Dec 2026 – 4 Jan 2027');
  });
});

describe('relative days', () => {
  it('counts calendar days across a month boundary and DST-observing dates', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('describes the distance from today', () => {
    expect(formatRelativeDays('2026-11-10', '2026-11-10')).toBe('today');
    expect(formatRelativeDays('2026-11-11', '2026-11-10')).toBe('tomorrow');
    expect(formatRelativeDays('2026-11-12', '2026-11-10')).toBe('in 2 days');
    expect(formatRelativeDays('2026-11-09', '2026-11-10')).toBe('yesterday');
    expect(formatRelativeDays('2026-11-02', '2026-11-10')).toBe('8 days ago');
  });
});

describe('12-hour times', () => {
  it.each([
    ['00:05', '12:05', 'AM'],
    ['08:00', '8:00', 'AM'],
    ['12:00', '12:00', 'PM'],
    ['20:00', '8:00', 'PM'],
  ])('splits %s', (value, time, period) => {
    expect(splitTime12h(value)).toEqual({ time, period });
  });

  it('formats a display time and rejects invalid input', () => {
    expect(formatTime12h('10:30')).toBe('10:30 AM');
    expect(() => splitTime12h('24:00')).toThrow();
    expect(() => splitTime12h('8:00')).toThrow();
  });
});
