import { MEDICAL_EVENT_TYPES } from './constants.js';
import {
  checkMedicalEventDate,
  normalizeMedicalNotes,
  normalizeMedicalTitle,
  normalizeProviderName,
} from './medical-rules.js';

const TITLE_ERROR = { error: 'Enter a title of 1–150 characters.' };
const NOTES_ERROR = { error: 'Keep notes to 5,000 characters.' };
const PROVIDER_ERROR = { error: 'Enter a provider name of up to 150 characters.' };
const FUTURE_ERROR = {
  error: "A medical event can't be in the future. Add planned visits in Appointments.",
};

describe('MEDICAL_EVENT_TYPES', () => {
  it('lists the five types in order', () => {
    expect(MEDICAL_EVENT_TYPES).toEqual([
      'VISIT',
      'DIAGNOSIS',
      'PROCEDURE',
      'ALLERGY',
      'GENERAL_NOTE',
    ]);
  });
});

describe('normalizeMedicalTitle', () => {
  it('trims', () => expect(normalizeMedicalTitle(' Check-up ')).toBe('Check-up'));
  it('needs 1–150 characters', () => {
    expect(normalizeMedicalTitle('')).toEqual(TITLE_ERROR);
    expect(normalizeMedicalTitle('   ')).toEqual(TITLE_ERROR);
    expect(normalizeMedicalTitle('a'.repeat(151))).toEqual(TITLE_ERROR);
  });
  it('counts code points', () => {
    expect(normalizeMedicalTitle('🐾'.repeat(150))).toBe('🐾'.repeat(150));
    expect(normalizeMedicalTitle('🐾'.repeat(151))).toEqual(TITLE_ERROR);
  });
});

describe('normalizeMedicalNotes', () => {
  it('stores blank notes as null', () => {
    expect(normalizeMedicalNotes('')).toBeNull();
    expect(normalizeMedicalNotes('  \n ')).toBeNull();
  });
  it('allows up to 5,000 characters', () => {
    expect(normalizeMedicalNotes(' Healthy ')).toBe('Healthy');
    expect(normalizeMedicalNotes('a'.repeat(5000))).toBe('a'.repeat(5000));
    expect(normalizeMedicalNotes('a'.repeat(5001))).toEqual(NOTES_ERROR);
  });
});

describe('normalizeProviderName', () => {
  it('stores a blank provider as null', () => {
    expect(normalizeProviderName('')).toBeNull();
    expect(normalizeProviderName('   ')).toBeNull();
  });
  it('trims and allows up to 150 characters', () => {
    expect(normalizeProviderName(' Dr Cruz ')).toBe('Dr Cruz');
    expect(normalizeProviderName('a'.repeat(151))).toEqual(PROVIDER_ERROR);
  });
});

describe('checkMedicalEventDate', () => {
  it('accepts today and earlier', () => {
    expect(checkMedicalEventDate('2026-11-24', '2026-11-24')).toBe('2026-11-24');
  });
  it('rejects a future date, pointing to Appointments', () => {
    expect(checkMedicalEventDate('2026-11-25', '2026-11-24')).toEqual(FUTURE_ERROR);
  });
  it('rejects dates before 1900', () => {
    expect(checkMedicalEventDate('1899-12-31', '2026-11-24')).toEqual({
      error: 'Enter a valid date.',
    });
  });
});
