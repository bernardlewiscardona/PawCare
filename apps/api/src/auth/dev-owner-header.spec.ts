import { DEV_OWNER_HEADER, devSubjectFromHeader } from './dev-owner-header.js';

describe('devSubjectFromHeader', () => {
  it('uses the X-Dev-Owner header (lower-cased, as Node delivers it)', () => {
    expect(DEV_OWNER_HEADER).toBe('x-dev-owner');
  });

  it('prefixes a valid name with dev: so it never collides with real sign-in subjects', () => {
    expect(devSubjectFromHeader('bea')).toBe('dev:bea');
    expect(devSubjectFromHeader('Owner_B-2')).toBe('dev:Owner_B-2');
    expect(devSubjectFromHeader('x'.repeat(64))).toBe(`dev:${'x'.repeat(64)}`);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too long', 'x'.repeat(65)],
    ['spaces', 'bea smith'],
    ['a colon', 'google:123'],
    ['non-ASCII letters', 'béa'],
    ['repeated header', ['bea', 'cal']],
  ])('rejects %s', (_label, value) => {
    expect(devSubjectFromHeader(value)).toBeNull();
  });
});
