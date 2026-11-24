import { describe, expect, it } from 'vitest';
import { addOtherOwnerPet, openReadyTestData } from '../testing/test-data';
import { beforeBirthWarning, ownerToday, readActivePet, readOwnedPetId } from './care-record';

async function setup(now?: Date) {
  const data = await openReadyTestData({ now });
  const mochi = await data.pets.create({ name: 'Mochi', species: 'CAT', birthDate: '2021-03-14' });
  return { ...data, mochi };
}

describe('care-record steps', () => {
  it("reads the owner's active pet", async () => {
    const { db, ownerId, mochi } = await setup();
    expect(await db.read((c) => readActivePet(c, ownerId, mochi.id))).toEqual({
      id: mochi.id,
      name: 'Mochi',
      birth_date: '2021-03-14',
    });
  });

  it('hides archived, malformed, unknown and other-owner pets', async () => {
    const { db, ownerId, mochi } = await setup();
    await db.write(['pets'], (c) =>
      c.run('UPDATE pets SET archived_at = ? WHERE id = ?', ['2026-11-24T09:00:00.000Z', mochi.id]),
    );
    const other = await addOtherOwnerPet(db);
    for (const id of [mochi.id, 'nope', '01900000-0000-7000-8000-0000000000ff', other.petId]) {
      expect(await db.read((c) => readActivePet(c, ownerId, id))).toBeUndefined();
    }
    expect(await db.read((c) => readOwnedPetId(c, ownerId, mochi.id))).toBe(mochi.id);
    expect(await db.read((c) => readOwnedPetId(c, ownerId, other.petId))).toBeUndefined();
    expect(await db.read((c) => readOwnedPetId(c, ownerId, 'nope'))).toBeUndefined();
  });

  it("works out today in the owner's zone", async () => {
    const { db, deps, ownerId } = await setup(new Date('2026-11-24T17:00:00Z'));
    expect(await db.read((c) => ownerToday(c, ownerId, deps))).toBe('2026-11-25');
  });

  it('warns only before the birth date', () => {
    const pet = { id: 'x', name: 'Mochi', birth_date: '2021-03-14' };
    expect(beforeBirthWarning(pet, '2021-03-13')).toBe(
      "This date is before Mochi's birth date. Save anyway?",
    );
    expect(beforeBirthWarning(pet, '2021-03-14')).toBeNull();
    expect(beforeBirthWarning({ ...pet, birth_date: null }, '1990-01-01')).toBeNull();
  });
});
