import { checkTimeZone, normalizeDisplayName, normalizePhone } from './profile-rules.js';

const NAME_ERROR = { error: 'Enter a name of 1–100 characters.' };
const ZONE_ERROR = { error: 'Choose a valid time zone.' };
const PHONE_ERROR = { error: 'Enter the number with its country code, like +63 917 123 4567.' };

describe('normalizeDisplayName', () => {
  it('trims spaces, tabs and newlines', () => {
    expect(normalizeDisplayName('  Bea Santos ')).toBe('Bea Santos');
    expect(normalizeDisplayName('\tBea\n')).toBe('Bea');
  });

  it('keeps Unicode names as entered', () => {
    expect(normalizeDisplayName('Bé Ánh 🐾')).toBe('Bé Ánh 🐾');
  });

  it('counts characters, not UTF-16 units, up to 100', () => {
    expect(normalizeDisplayName('x'.repeat(100))).toBe('x'.repeat(100));
    expect(normalizeDisplayName('🐾'.repeat(100))).toBe('🐾'.repeat(100));
  });

  it.each([['x'.repeat(101)], ['   '], ['']])('rejects %j', (value) => {
    expect(normalizeDisplayName(value)).toEqual(NAME_ERROR);
  });
});

describe('checkTimeZone', () => {
  it.each([['Asia/Manila'], ['Europe/London'], ['UTC']])('accepts %s', (zone) => {
    expect(checkTimeZone(zone)).toBe(zone);
  });

  it.each([['Mars/Base'], ['GMT+8'], ['asia/manila'], ['']])('rejects %j', (zone) => {
    expect(checkTimeZone(zone)).toEqual(ZONE_ERROR);
  });
});

describe('normalizePhone', () => {
  it('stores numbers in international (E.164) format', () => {
    expect(normalizePhone('+63 917 123 4567')).toBe('+639171234567');
    expect(normalizePhone('+63 (917) 123-4567')).toBe('+639171234567');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('treats null as removing the number', () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it.each([['09171234567'], ['+63 123'], [`+63${'9'.repeat(30)}`], ['']])(
    'asks for the country code and a valid number for %j',
    (value) => {
      expect(normalizePhone(value)).toEqual(PHONE_ERROR);
    },
  );
});
