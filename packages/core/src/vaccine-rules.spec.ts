import {
  checkNextDueDate,
  checkVaccinationDate,
  normalizeBatchLabel,
  normalizeVaccineName,
} from './vaccine-rules.js';
import { checkDate } from './pet-rules.js';

const NAME_ERROR = { error: 'Enter a vaccine name of 1–150 characters.' };
const BATCH_ERROR = { error: 'Enter a batch of up to 100 characters.' };
const DATE_ERROR = { error: 'Enter a valid date.' };

describe('checkDate', () => {
  it('accepts a real date from 1900', () => expect(checkDate('1900-01-01')).toBe('1900-01-01'));
  it('rejects impossible or early dates', () => {
    for (const value of ['2026-02-30', '1899-12-31', '2026-1-1', 'x']) {
      expect(checkDate(value)).toEqual(DATE_ERROR);
    }
  });
});

describe('normalizeVaccineName', () => {
  it('trims', () => expect(normalizeVaccineName(' Rabies ')).toBe('Rabies'));
  it('needs 1–150 code points', () => {
    expect(normalizeVaccineName('')).toEqual(NAME_ERROR);
    expect(normalizeVaccineName('a'.repeat(151))).toEqual(NAME_ERROR);
    expect(normalizeVaccineName('🐾'.repeat(150))).toBe('🐾'.repeat(150));
  });
});

describe('normalizeBatchLabel', () => {
  it('stores a blank batch as null', () => expect(normalizeBatchLabel('  ')).toBeNull());
  it('trims and allows up to 100 characters', () => {
    expect(normalizeBatchLabel(' A12 ')).toBe('A12');
    expect(normalizeBatchLabel('a'.repeat(100))).toBe('a'.repeat(100));
    expect(normalizeBatchLabel('a'.repeat(101))).toEqual(BATCH_ERROR);
  });
});

describe('checkVaccinationDate', () => {
  it('rejects the future', () => {
    expect(checkVaccinationDate('2026-11-25', '2026-11-24')).toEqual({
      error: "The vaccination date can't be in the future.",
    });
    expect(checkVaccinationDate('2026-11-24', '2026-11-24')).toBe('2026-11-24');
  });
  it('rejects dates before 1900', () => {
    expect(checkVaccinationDate('1899-12-31', '2026-11-24')).toEqual(DATE_ERROR);
  });
});

describe('checkNextDueDate', () => {
  it('rejects a due date before the vaccination date', () => {
    expect(checkNextDueDate('2026-01-09', '2026-01-10')).toEqual({
      error: "The next due date can't be before the vaccination date.",
    });
  });
  it('allows the same day and past due dates', () => {
    expect(checkNextDueDate('2026-01-10', '2026-01-10')).toBe('2026-01-10');
    expect(checkNextDueDate('2020-01-01', '2019-06-01')).toBe('2020-01-01');
  });
  it('rejects an impossible date', () => {
    expect(checkNextDueDate('2026-02-30', '2026-01-10')).toEqual(DATE_ERROR);
  });
});
