import { randomBytes } from 'node:crypto';
import { createUuidV7 } from './uuidv7.js';

const FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const random = (n: number) => new Uint8Array(randomBytes(n));

describe('createUuidV7', () => {
  it('follows the RFC 9562 layout with the timestamp first', () => {
    const next = createUuidV7(
      (n) => new Uint8Array(n).fill(0xab),
      () => 0x0190_1234_5678,
    );
    const id = next();
    expect(id).toMatch(FORMAT);
    expect(id.replaceAll('-', '').slice(0, 12)).toBe('019012345678');
  });

  it('is strictly increasing within one millisecond', () => {
    const next = createUuidV7(random, () => 1_700_000_000_000);
    const ids = Array.from({ length: 1000 }, next);
    for (let i = 1; i < ids.length; i++) expect(ids[i] > ids[i - 1]).toBe(true);
  });

  it('stays increasing when the counter overflows', () => {
    // All-0xff random bytes seed the counter at its maximum seed, forcing early overflow.
    const next = createUuidV7(
      (n) => new Uint8Array(n).fill(0xff),
      () => 1_700_000_000_000,
    );
    const ids = Array.from({ length: 5000 }, next);
    for (let i = 1; i < ids.length; i++) expect(ids[i] > ids[i - 1]).toBe(true);
  });

  it('sorts a later millisecond after every earlier ID', () => {
    let now = 1_700_000_000_000;
    const next = createUuidV7(random, () => now);
    const earlier = Array.from({ length: 100 }, next);
    now += 1;
    const later = next();
    for (const id of earlier) expect(later > id).toBe(true);
  });
});
