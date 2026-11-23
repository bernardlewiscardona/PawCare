import {
  checkPastOrToday,
  normalizeMicrochip,
  normalizeOptionalText,
  normalizePetName,
  toKilograms,
} from './pet-rules.js';

const WEIGHT_ERROR = { error: 'Enter a weight above 0 and up to 1,000 kg.' };

describe('toKilograms', () => {
  it('keeps kilograms and converts pounds, rounded to the gram', () => {
    expect(toKilograms(9.5, 'KG')).toBe(9.5);
    expect(toKilograms(22, 'LB')).toBe(9.979);
    expect(toKilograms(0.002, 'LB')).toBe(0.001);
    expect(toKilograms(1000, 'KG')).toBe(1000);
  });

  it.each([
    [0, 'KG'],
    [-1, 'KG'],
    [1000.001, 'KG'],
    [2205, 'LB'],
    [0.001, 'LB'],
  ] as const)('rejects %s %s', (value, unit) => {
    expect(toKilograms(value, unit)).toEqual(WEIGHT_ERROR);
  });
});

describe('checkPastOrToday', () => {
  const future = "The birth date can't be in the future.";

  it('accepts today and earlier', () => {
    expect(checkPastOrToday('2026-11-24', '2026-11-24', future)).toBe('2026-11-24');
    expect(checkPastOrToday('2019-02-28', '2026-11-24', future)).toBe('2019-02-28');
  });

  it('rejects a future date with the given message', () => {
    expect(checkPastOrToday('2026-11-25', '2026-11-24', future)).toEqual({ error: future });
  });

  it.each([['2026-02-30'], ['24/11/2026'], ['2026-13-01'], ['']])(
    'rejects %j as not a real date',
    (value) => {
      expect(checkPastOrToday(value, '2026-11-24', future)).toEqual({
        error: 'Enter a valid date.',
      });
    },
  );
});

describe('normalizeMicrochip', () => {
  it('trims letters and digits', () => {
    expect(normalizeMicrochip(' 985112345678901 ')).toBe('985112345678901');
  });

  it.each([['985-112'], ['x'.repeat(51)], ['']])('rejects %j', (value) => {
    expect(normalizeMicrochip(value)).toEqual({ error: 'Enter 1–50 letters or digits.' });
  });
});

describe('normalizePetName', () => {
  it('trims and requires 1–100 characters', () => {
    expect(normalizePetName('  Mochi ')).toBe('Mochi');
    expect(normalizePetName('   ')).toEqual({ error: 'Enter a name of 1–100 characters.' });
  });
});

describe('normalizeOptionalText', () => {
  it('trims and enforces the maximum with the given message', () => {
    expect(normalizeOptionalText(' Shiba ', 100, 'msg')).toBe('Shiba');
    expect(normalizeOptionalText('x'.repeat(101), 100, 'msg')).toEqual({ error: 'msg' });
    expect(normalizeOptionalText('  ', 100, 'msg')).toEqual({ error: 'msg' });
  });
});
