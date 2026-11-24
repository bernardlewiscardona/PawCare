import { describe, expect, it } from 'vitest';
import { DataError } from '../errors';
import { CHOOSE_UNIT, INVALID, NOT_ALLOWED, VERSION } from '../shape';
import { openTestData } from '../testing/test-data';

async function rejection(p: Promise<unknown>): Promise<DataError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    return e as DataError;
  }
  throw new Error('expected rejection');
}

const setup = { version: 1, displayName: ' Bé Ánh 🐾 ', timeZone: 'Asia/Manila' };

describe('owner repository', () => {
  it('starts as a placeholder needing setup', async () => {
    const { owner } = await openTestData();
    expect(await owner.get()).toMatchObject({
      profileSetupRequired: true,
      displayName: null,
      timeZone: 'UTC',
      weightUnit: 'KG',
      version: 1,
    });
  });

  it('completes setup on the first save', async () => {
    const { owner } = await openTestData();
    expect(await owner.update(setup)).toMatchObject({
      displayName: 'Bé Ánh 🐾',
      profileSetupRequired: false,
      version: 2,
    });
  });

  it('requires time zone on first save and stores nothing', async () => {
    const { owner } = await openTestData();
    const e = await rejection(owner.update({ version: 1, displayName: 'Bea' }));
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.message).toBe('Request validation failed');
    expect((e.details as any).fields.timeZone).toEqual([
      'Required to finish setting up your profile.',
    ]);
    expect(await owner.get()).toMatchObject({ displayName: null, version: 1 });
  });

  it('normalizes, rejects and clears the phone', async () => {
    const { owner } = await openTestData();
    await owner.update(setup);
    expect((await owner.update({ version: 2, phone: '+63 917 123 4567' })).phone).toBe(
      '+639171234567',
    );
    const e = await rejection(owner.update({ version: 3, phone: '09171234567' }));
    expect((e.details as any).fields.phone).toHaveLength(1);
    expect((await owner.update({ version: 3, phone: null })).phone).toBeNull();
  });

  it('returns CONFLICT with the current profile for a stale version', async () => {
    const { owner } = await openTestData();
    await owner.update(setup);
    const e = await rejection(owner.update({ version: 1, weightUnit: 'LB' }));
    expect(e.code).toBe('CONFLICT');
    expect((e.details as any).current).toEqual(await owner.get());
  });

  it('lets only one of two updates with the same version win', async () => {
    const { owner } = await openTestData();
    await owner.update(setup);
    const results = await Promise.allSettled([
      owner.update({ version: 2, weightUnit: 'LB' }),
      owner.update({ version: 2, phone: '+639171234567' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason.code).toBe('CONFLICT');
  });

  it('does nothing for a version-only update after setup', async () => {
    const { owner, db } = await openTestData();
    const saved = await owner.update(setup);
    const before = await db.read((c) => c.all('SELECT id FROM change_log'));
    expect(await owner.update({ version: 2 })).toEqual(saved);
    expect(await db.read((c) => c.all('SELECT id FROM change_log'))).toEqual(before);
  });

  it('reports shape errors', async () => {
    const { owner } = await openTestData();
    await owner.update(setup);
    const a = await rejection(owner.update({ version: 2, authSubject: 'x' } as never));
    expect((a.details as any).fields.authSubject).toEqual([NOT_ALLOWED]);
    const b = await rejection(owner.update({ version: 'two' } as never));
    expect((b.details as any).fields.version).toEqual([VERSION]);
    const c = await rejection(owner.update({ version: 2, weightUnit: 'STONE' } as never));
    expect((c.details as any).fields.weightUnit).toEqual([CHOOSE_UNIT]);
  });

  it('uses the shared message for a wrong-typed field', async () => {
    const { owner } = await openTestData();
    await owner.update(setup);
    const e = await rejection(owner.update({ version: 2, displayName: 5 } as never));
    expect((e.details as any).fields.displayName).toEqual([INVALID]);
    expect(INVALID).toBe('Enter a valid value.');
  });

  it('logs one profile_updated row with field names only', async () => {
    const { owner, db } = await openTestData();
    await owner.update(setup);
    const rows = await db.read((c) =>
      c.all<{ fields: string }>("SELECT * FROM change_log WHERE action = 'owner.profile_updated'"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fields).toBe('["displayName","timeZone"]');
    const text = JSON.stringify(rows[0]);
    expect(text).not.toContain('Ánh');
    expect(text).not.toContain('Asia/Manila');
  });
});
