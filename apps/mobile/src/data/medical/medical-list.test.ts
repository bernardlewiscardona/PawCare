import { describe, expect, it } from 'vitest';
import { DataError } from '../errors';
import { addOtherOwnerPet, openReadyTestData } from '../testing/test-data';

async function rejection(p: Promise<unknown>): Promise<DataError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    return e as DataError;
  }
  throw new Error('expected rejection');
}

const fieldsOf = (e: DataError) => (e.details as { fields: Record<string, string[]> }).fields;
const CURSOR = ['Use the nextCursor from the previous page.'];

async function setup() {
  const data = await openReadyTestData();
  const mochi = await data.pets.create({ name: 'Mochi', species: 'CAT' });
  const rex = await data.pets.create({ name: 'Rex', species: 'DOG' });
  const add = (petId: string, occurrenceDate: string, title = 'Entry') =>
    data.medical.create({ petId, eventType: 'VISIT', title, occurrenceDate });
  return { ...data, mochi, rex, add };
}

describe('medical repository: listForPet', () => {
  it('lists newest first with the ID as tiebreak', async () => {
    const { medical, mochi, add } = await setup();
    const jan = await add(mochi.id, '2026-01-05');
    const mar1 = await add(mochi.id, '2026-03-01');
    const mar2 = await add(mochi.id, '2026-03-01');
    const dec = await add(mochi.id, '2025-12-31');
    const page = await medical.listForPet(mochi.id);
    expect(page.data.map((e) => e.id)).toEqual([mar2.id, mar1.id, jan.id, dec.id]);
    expect(page.nextCursor).toBeNull();
  });

  it('pages with a cursor', async () => {
    const { medical, mochi, add } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      ids.push((await add(mochi.id, `2026-0${(i % 9) + 1}-${day}`)).id);
    }
    const first = await medical.listForPet(mochi.id);
    expect(first.data).toHaveLength(20);
    expect(first.nextCursor).toBe(first.data[19].id);
    const second = await medical.listForPet(mochi.id, { cursor: first.nextCursor! });
    expect(second.data).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const all = [...first.data, ...second.data];
    expect(new Set(all.map((e) => e.id))).toEqual(new Set(ids));
    const keys = all.map((e) => `${e.occurrenceDate}|${e.id}`);
    expect(keys).toEqual([...keys].sort().reverse());
    expect((await medical.listForPet(mochi.id, { limit: 5 })).data).toHaveLength(5);
  });

  it("shows only this pet's records", async () => {
    const { medical, mochi, rex, add } = await setup();
    const own = await add(mochi.id, '2026-01-01');
    await add(rex.id, '2026-01-02');
    expect((await medical.listForPet(mochi.id)).data.map((e) => e.id)).toEqual([own.id]);
  });

  it("still lists an archived pet's records", async () => {
    const { medical, mochi, add, db } = await setup();
    const own = await add(mochi.id, '2026-01-01');
    await db.write(['pets'], (c) =>
      c.run('UPDATE pets SET archived_at = ? WHERE id = ?', ['2026-11-24T09:00:00.000Z', mochi.id]),
    );
    expect((await medical.listForPet(mochi.id)).data.map((e) => e.id)).toEqual([own.id]);
  });

  it("refuses another owner's pet and unknown pets", async () => {
    const { medical, db } = await setup();
    const other = await addOtherOwnerPet(db);
    for (const petId of [other.petId, '01900000-0000-7000-8000-0000000000ff', 'nope']) {
      const e = await rejection(medical.listForPet(petId));
      expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
    }
  });

  it('rejects a bad limit and cursors that are malformed, unknown, from another pet or owner', async () => {
    const { medical, mochi, rex, add, db } = await setup();
    await add(mochi.id, '2026-01-01');
    const rexEvent = await add(rex.id, '2026-01-01');
    const other = await addOtherOwnerPet(db);
    const theirs = '01900000-0000-7000-8000-0000000000c1';
    await db.write(['care_records', 'medical_events'], async (c) => {
      await c.run(
        `INSERT INTO care_records (id, owner_id, pet_id, kind, occurrence_date, created_at, updated_at)
         VALUES (?, ?, ?, 'MEDICAL', '2026-01-01', ?, ?)`,
        [
          theirs,
          other.ownerId,
          other.petId,
          '2026-11-24T00:00:00.000Z',
          '2026-11-24T00:00:00.000Z',
        ],
      );
      await c.run(
        `INSERT INTO medical_events (record_id, owner_id, pet_id, event_type, title)
         VALUES (?, ?, ?, 'VISIT', 'Theirs')`,
        [theirs, other.ownerId, other.petId],
      );
    });
    for (const cursor of ['nope', '01900000-0000-7000-8000-0000000000ff', rexEvent.id, theirs]) {
      expect(fieldsOf(await rejection(medical.listForPet(mochi.id, { cursor })))).toEqual({
        cursor: CURSOR,
      });
    }
    for (const limit of [0, 101]) {
      expect(fieldsOf(await rejection(medical.listForPet(mochi.id, { limit }))).limit).toEqual([
        'Choose a page size of 1–100.',
      ]);
    }
  });
});
