import {
  checkPastOrToday,
  normalizeMicrochip,
  normalizeOptionalText,
  normalizePetName,
  toGrams,
} from './pet-rules.js';

const KG_ERROR = { error: 'Enter a weight above 0 and up to 1,000 kg.' };
const LB_ERROR = { error: 'Enter a weight above 0 and up to 2,204.62 lb.' };

describe('toGrams', () => {
  it('keeps kilograms and converts pounds, rounded to the gram', () => {
    expect(toGrams(9.5, 'KG')).toBe(9500);
    expect(toGrams(4.234, 'KG')).toBe(4234);
    expect(toGrams(0.015, 'KG')).toBe(15);
    expect(toGrams(22, 'LB')).toBe(9979);
    expect(toGrams(0.002, 'LB')).toBe(1);
    expect(toGrams(1000, 'KG')).toBe(1000000);
    expect(toGrams(2204.62, 'LB')).toBe(999999);
  });

  it.each([
    [0, 'KG', KG_ERROR],
    [-1, 'KG', KG_ERROR],
    [1000.001, 'KG', KG_ERROR],
    [2205, 'LB', LB_ERROR],
    [2204.623, 'LB', LB_ERROR],
    [0.001, 'LB', LB_ERROR],
  ] as const)('rejects %s %s in the unit entered', (value, unit, error) => {
    expect(toGrams(value, unit)).toEqual(error);
  });

  it('rejects kilograms finer than a gram instead of rounding them', () => {
    const error = { error: 'Enter kilograms with up to 3 decimal places.' };
    expect(toGrams(4.2345, 'KG')).toEqual(error);
    expect(toGrams(1000.0004, 'KG')).toEqual(error);
  });
});

describe('checkPastOrToday', () => {
  const future = "The birth date can't be in the future.";

  it('accepts today and earlier', () => {
    expect(checkPastOrToday('2026-11-24', '2026-11-24', future)).toBe('2026-11-24');
    expect(checkPastOrToday('2019-02-28', '2026-11-24', future)).toBe('2019-02-28');
    expect(checkPastOrToday('1900-01-01', '2026-11-24', future)).toBe('1900-01-01');
  });

  it('rejects a future date with the given message', () => {
    expect(checkPastOrToday('2026-11-25', '2026-11-24', future)).toEqual({ error: future });
  });

  it.each([['2026-02-30'], ['24/11/2026'], ['2026-13-01'], [''], ['0099-05-01'], ['1899-12-31']])(
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
