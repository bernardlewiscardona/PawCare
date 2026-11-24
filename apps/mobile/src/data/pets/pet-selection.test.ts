import { describe, expect, it, vi } from 'vitest';
import { DataError } from '../errors';
import { addOtherOwnerPet, openReadyTestData } from '../testing/test-data';
import type { Database } from '../database';
import { createPetRepository } from './pet-repository';

const archive = (db: Database, id: string) =>
  db.write(['pets'], (c) =>
    c.run('UPDATE pets SET archived_at = ? WHERE id = ?', ['2026-11-24T09:00:00.000Z', id]),
  );

const storedSelection = (db: Database) =>
  db.read((c) => c.all<{ pet_id: string }>('SELECT pet_id FROM pet_selection'));

describe('pet selection', () => {
  it('returns null with no pets', async () => {
    const { pets } = await openReadyTestData();
    expect(await pets.selected()).toBeNull();
  });

  it('selects a newly created pet', async () => {
    const { pets } = await openReadyTestData();
    await pets.create({ name: 'Mochi', species: 'CAT' });
    const b = await pets.create({ name: 'Rex', species: 'DOG' });
    expect(await pets.selected()).toEqual(b);
  });

  it('switches and survives a new repository', async () => {
    const { pets, db, deps, ownerId } = await openReadyTestData();
    const a = await pets.create({ name: 'Mochi', species: 'CAT' });
    await pets.create({ name: 'Rex', species: 'DOG' });
    expect(await pets.select(a.id)).toEqual(a);
    expect(await createPetRepository(db, deps, ownerId).selected()).toEqual(a);
  });

  it('falls back to the oldest active pet when the selected one is archived', async () => {
    const { pets, db } = await openReadyTestData();
    const a = await pets.create({ name: 'Mochi', species: 'CAT' });
    const b = await pets.create({ name: 'Rex', species: 'DOG' });
    await pets.create({ name: 'Kiwi', species: 'BIRD' });
    await pets.select(b.id);
    await archive(db, b.id);
    expect((await pets.selected())?.id).toBe(a.id);
    expect(await storedSelection(db)).toEqual([{ pet_id: b.id }]);
  });

  it('returns null when every pet is archived', async () => {
    const { pets, db } = await openReadyTestData();
    const a = await pets.create({ name: 'Mochi', species: 'CAT' });
    await archive(db, a.id);
    expect(await pets.selected()).toBeNull();
  });

  it('refuses unknown, malformed, archived and other-owner pets', async () => {
    const { pets, db } = await openReadyTestData();
    const a = await pets.create({ name: 'Mochi', species: 'CAT' });
    const archived = await pets.create({ name: 'Old', species: 'DOG' });
    await archive(db, archived.id);
    await pets.select(a.id);
    const other = await addOtherOwnerPet(db);
    for (const id of [
      '01900000-0000-7000-8000-0000000000ff',
      'not-a-uuid',
      archived.id,
      other.petId,
    ]) {
      const e = await pets.select(id).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(DataError);
      const { code, message, details } = e as DataError;
      expect([code, message, details]).toEqual(['NOT_FOUND', 'Not found', null]);
    }
    expect(await storedSelection(db)).toEqual([{ pet_id: a.id }]);
  });

  it('ignores another owner selecting their own pet', async () => {
    const { pets, db, deps } = await openReadyTestData();
    const a = await pets.create({ name: 'Mochi', species: 'CAT' });
    const other = await addOtherOwnerPet(db);
    await createPetRepository(db, deps, other.ownerId).select(other.petId);
    expect(await pets.selected()).toEqual(a);
  });

  it('rolls the selection back with a failed create', async () => {
    const { pets, db, deps } = await openReadyTestData();
    vi.spyOn(deps, 'newId').mockReturnValue('bad');
    await expect(pets.create({ name: 'Mochi', species: 'CAT' })).rejects.toBeTruthy();
    expect(await storedSelection(db)).toEqual([]);
  });

  it('writes no change_log row for a selection', async () => {
    const { pets, db } = await openReadyTestData();
    const a = await pets.create({ name: 'Mochi', species: 'CAT' });
    await pets.create({ name: 'Rex', species: 'DOG' });
    const before = await db.read((c) =>
      c.get<{ n: number }>('SELECT count(*) AS n FROM change_log'),
    );
    await pets.select(a.id);
    const after = await db.read((c) =>
      c.get<{ n: number }>('SELECT count(*) AS n FROM change_log'),
    );
    expect(after).toEqual(before);
  });
});
