import { describe, expect, it } from 'vitest';
import { DataError } from '../errors';
import { openReadyTestData } from '../testing/test-data';

async function rejection(p: Promise<unknown>): Promise<DataError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    return e as DataError;
  }
  throw new Error('expected rejection');
}

const warningsOf = (e: DataError) => (e.details as { warnings: Record<string, string[]> }).warnings;

async function setup() {
  const data = await openReadyTestData();
  const mochi = await data.pets.create({ name: 'Mochi', species: 'CAT', birthDate: '2021-03-14' });
  const rex = await data.pets.create({ name: 'Rex', species: 'DOG' });
  const add = (input: Record<string, unknown>) =>
    data.vaccines.create({
      petId: mochi.id,
      vaccineName: 'Rabies',
      administeredOn: '2026-11-20',
      ...input,
    } as never);
  const count = async () =>
    (await data.db.read((c) => c.get<{ n: number }>('SELECT count(*) AS n FROM vaccinations')))!.n;
  return { ...data, mochi, rex, add, count };
}

describe('vaccine warnings', () => {
  it('asks before saving a similar entry, then saves it when confirmed', async () => {
    const { add, count } = await setup();
    await add({});
    const e = await rejection(add({ vaccineName: ' rabies ' }));
    expect(e.code).toBe('CONFIRMATION_REQUIRED');
    expect(e.details).toEqual({
      warnings: {
        vaccineName: ['You already recorded rabies for Mochi on this date. Save anyway?'],
      },
    });
    expect(await count()).toBe(1);
    await add({ vaccineName: ' rabies ', confirmSimilar: true });
    expect(await count()).toBe(2);
  });

  it('does not warn for a later dose, a different name or another pet', async () => {
    const { add, rex, count } = await setup();
    await add({});
    await add({ administeredOn: '2026-11-21' });
    await add({ vaccineName: 'Rabies 3-year' });
    await add({ petId: rex.id });
    expect(await count()).toBe(4);
  });

  it('ignores voided vaccinations', async () => {
    const { add, db, count } = await setup();
    const first = await add({});
    await db.write(['care_records'], (c) =>
      c.run(
        "UPDATE care_records SET status = 'VOIDED', void_reason = 'Wrong pet', voided_at = ? WHERE id = ?",
        ['2026-11-24T09:00:00.000Z', first.id],
      ),
    );
    await add({});
    expect(await count()).toBe(2);
  });

  it('asks before a date before birth', async () => {
    const { add, count } = await setup();
    const e = await rejection(add({ administeredOn: '2021-03-13' }));
    expect(warningsOf(e)).toEqual({
      administeredOn: ["This date is before Mochi's birth date. Save anyway?"],
    });
    await add({ administeredOn: '2021-03-13', confirmBeforeBirth: true });
    expect(await count()).toBe(1);
  });

  it('returns both warnings together and keeps asking for the unconfirmed one', async () => {
    const { add, count } = await setup();
    await add({ administeredOn: '2021-03-13', confirmBeforeBirth: true });
    const both = await rejection(add({ administeredOn: '2021-03-13' }));
    expect(Object.keys(warningsOf(both)).sort()).toEqual(['administeredOn', 'vaccineName']);
    const one = await rejection(add({ administeredOn: '2021-03-13', confirmSimilar: true }));
    expect(Object.keys(warningsOf(one))).toEqual(['administeredOn']);
    await add({ administeredOn: '2021-03-13', confirmSimilar: true, confirmBeforeBirth: true });
    expect(await count()).toBe(2);
  });

  it('reports field errors before warnings', async () => {
    const { add } = await setup();
    await add({});
    const e = await rejection(add({ batchLabel: 'a'.repeat(101) }));
    expect(e.code).toBe('VALIDATION_FAILED');
  });
});
