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
  let n = 0;
  // Distinct names so the similar-entry warning never fires.
  const add = (petId: string, administeredOn: string, nextDueOn?: string) =>
    data.vaccines.create({ petId, vaccineName: `Dose ${n++}`, administeredOn, nextDueOn });
  return { ...data, mochi, rex, add };
}

describe('vaccine repository: listForPet', () => {
  it('lists newest first with the ID as tiebreak and fills nextDue', async () => {
    const { vaccines, mochi, add } = await setup();
    const jan = await add(mochi.id, '2026-01-05', '2027-01-05');
    const mar1 = await add(mochi.id, '2026-03-01');
    const mar2 = await add(mochi.id, '2026-03-01');
    const dec = await add(mochi.id, '2025-12-31', '2026-01-31');
    const page = await vaccines.listForPet(mochi.id);
    expect(page.data.map((v) => v.id)).toEqual([mar2.id, mar1.id, jan.id, dec.id]);
    expect(page.data.map((v) => v.nextDue?.overdue ?? null)).toEqual([null, null, false, true]);
    expect(page.nextCursor).toBeNull();
  });

  it('pages with a cursor', async () => {
    const { vaccines, mochi, add } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      ids.push((await add(mochi.id, `2026-0${(i % 9) + 1}-${day}`)).id);
    }
    const first = await vaccines.listForPet(mochi.id);
    expect(first.data).toHaveLength(20);
    expect(first.nextCursor).toBe(first.data[19].id);
    const second = await vaccines.listForPet(mochi.id, { cursor: first.nextCursor! });
    expect(second.data).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const all = [...first.data, ...second.data];
    expect(new Set(all.map((v) => v.id))).toEqual(new Set(ids));
    const keys = all.map((v) => `${v.administeredOn}|${v.id}`);
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it("shows only this pet's vaccines, and still an archived pet's", async () => {
    const { vaccines, mochi, rex, add, db } = await setup();
    const own = await add(mochi.id, '2026-01-01');
    await add(rex.id, '2026-01-02');
    await db.write(['pets'], (c) =>
      c.run('UPDATE pets SET archived_at = ? WHERE id = ?', ['2026-11-24T09:00:00.000Z', mochi.id]),
    );
    expect((await vaccines.listForPet(mochi.id)).data.map((v) => v.id)).toEqual([own.id]);
  });

  it("refuses another owner's pet and unknown pets", async () => {
    const { vaccines, db } = await setup();
    const other = await addOtherOwnerPet(db);
    for (const petId of [other.petId, '01900000-0000-7000-8000-0000000000ff', 'nope']) {
      const e = await rejection(vaccines.listForPet(petId));
      expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
    }
  });

  it('rejects a bad limit and cursors that are not this list', async () => {
    const { vaccines, medical, mochi, rex, add, db } = await setup();
    await add(mochi.id, '2026-01-01');
    const rexDose = await add(rex.id, '2026-01-01');
    const medicalEvent = await medical.create({
      petId: mochi.id,
      eventType: 'VISIT',
      title: 'Check-up',
      occurrenceDate: '2026-01-01',
    });
    const other = await addOtherOwnerPet(db);
    const theirs = '01900000-0000-7000-8000-0000000000c1';
    await db.write(['care_records', 'vaccinations'], async (c) => {
      await c.run(
        `INSERT INTO care_records (id, owner_id, pet_id, kind, occurrence_date, created_at, updated_at)
         VALUES (?, ?, ?, 'VACCINE', '2026-01-01', ?, ?)`,
        [
          theirs,
          other.ownerId,
          other.petId,
          '2026-11-24T00:00:00.000Z',
          '2026-11-24T00:00:00.000Z',
        ],
      );
      await c.run(
        `INSERT INTO vaccinations (record_id, owner_id, pet_id, vaccine_name, administered_on)
         VALUES (?, ?, ?, 'Theirs', '2026-01-01')`,
        [theirs, other.ownerId, other.petId],
      );
    });
    for (const cursor of [
      'nope',
      '01900000-0000-7000-8000-0000000000ff',
      medicalEvent.id,
      rexDose.id,
      theirs,
    ]) {
      expect(fieldsOf(await rejection(vaccines.listForPet(mochi.id, { cursor })))).toEqual({
        cursor: CURSOR,
      });
    }
    for (const limit of [0, 101]) {
      expect(fieldsOf(await rejection(vaccines.listForPet(mochi.id, { limit }))).limit).toEqual([
        'Choose a page size of 1–100.',
      ]);
    }
  });
});
