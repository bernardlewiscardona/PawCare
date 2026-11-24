import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database';
import { DataError } from '../errors';
import { addOtherOwnerPet, openReadyTestData } from '../testing/test-data';
import type { Pet } from '../types';

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

const petLogs = (db: Database) =>
  db.read((c) =>
    c.all<{ action: string; fields: string; entity_version: number }>(
      "SELECT action, fields, entity_version FROM change_log WHERE entity_type = 'pet' ORDER BY occurred_at, id",
    ),
  );

async function withPet(
  extra: Partial<
    Parameters<Awaited<ReturnType<typeof openReadyTestData>>['pets']['create']>[0]
  > = {},
  now?: Date,
) {
  const data = await openReadyTestData({ now });
  const pet = await data.pets.create({ name: 'Mochi', species: 'CAT', ...extra });
  return { ...data, pet };
}

describe('pet repository: update', () => {
  it('updates fields and bumps the version', async () => {
    const { pets, pet } = await withPet();
    const updated = await pets.update({
      id: pet.id,
      version: 1,
      name: ' Mochi II ',
      sex: 'FEMALE',
    });
    expect(updated).toEqual({ ...pet, name: 'Mochi II', sex: 'FEMALE', version: 2 });
    expect(await pets.get(pet.id)).toEqual(updated);
  });

  it('clears optional fields', async () => {
    const { pets, pet } = await withPet({
      breed: 'Aspin',
      birthDate: '2021-03-14',
      birthDateEstimated: true,
      weight: { value: 4, unit: 'KG' },
      microchip: '985112345678901',
    });
    const updated = await pets.update({
      id: pet.id,
      version: 1,
      breed: null,
      birthDate: null,
      weight: null,
      microchip: null,
    });
    expect(updated).toMatchObject({
      breed: null,
      birthDate: null,
      birthDateEstimated: false,
      currentWeightKg: null,
      weightMeasuredOn: null,
      microchip: null,
      version: 2,
    });
  });

  it('stores an LB weight like create', async () => {
    const { pets, pet } = await withPet();
    const updated = await pets.update({
      id: pet.id,
      version: 1,
      weight: { value: 22, unit: 'LB' },
    });
    expect(updated.currentWeightKg).toBe(9.979);
    expect(updated.weightMeasuredOn).toBe('2026-11-24');
  });

  it('keeps the measurement date when the same weight is sent again', async () => {
    const { pets, pet, db } = await withPet({
      weight: { value: 4, unit: 'KG' },
      weightMeasuredOn: '2026-11-01',
    });
    const same = await pets.update({ id: pet.id, version: 1, weight: { value: 4, unit: 'KG' } });
    expect(same).toEqual(pet);
    const renamed = await pets.update({
      id: pet.id,
      version: 1,
      name: 'Mochi II',
      weight: { value: 4, unit: 'KG' },
    });
    expect(renamed.weightMeasuredOn).toBe('2026-11-01');
    expect(JSON.parse((await petLogs(db))[1].fields)).toEqual(['name']);
  });

  it('keeps the measurement date when only the date is corrected', async () => {
    const { pets, pet } = await withPet({ weight: { value: 4, unit: 'KG' } });
    const updated = await pets.update({ id: pet.id, version: 1, weightMeasuredOn: '2026-11-01' });
    expect(updated).toMatchObject({ currentWeightKg: 4, weightMeasuredOn: '2026-11-01' });
  });

  it('applies the PF-02 rules and writes nothing', async () => {
    const { pets, pet, db } = await withPet();
    const e = await rejection(
      pets.update({
        id: pet.id,
        version: 1,
        name: '  ',
        birthDate: '2026-11-25',
        weight: { value: 0, unit: 'KG' },
      }),
    );
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(fieldsOf(e).birthDate).toEqual(["The birth date can't be in the future."]);
    expect(fieldsOf(e).weight).toEqual(['Enter a weight above 0 and up to 1,000 kg.']);
    expect(Object.keys(fieldsOf(e)).sort()).toEqual(['birthDate', 'name', 'weight']);
    expect(await pets.get(pet.id)).toEqual(pet);
    expect(await petLogs(db)).toHaveLength(1);
  });

  describe('paired fields', () => {
    it('needs a description when changing to Other', async () => {
      const { pets, pet } = await withPet();
      const e = await rejection(pets.update({ id: pet.id, version: 1, species: 'OTHER' }));
      expect(fieldsOf(e).speciesOther).toEqual(['Describe the species in 1–100 characters.']);
      const ok = await pets.update({
        id: pet.id,
        version: 1,
        species: 'OTHER',
        speciesOther: ' Tortoise ',
      });
      expect(ok).toMatchObject({ species: 'OTHER', speciesOther: 'Tortoise' });
    });

    it('refuses clearing the description while the species stays Other', async () => {
      const { pets, pet } = await withPet({ species: 'OTHER', speciesOther: 'Tortoise' });
      const e = await rejection(pets.update({ id: pet.id, version: 1, speciesOther: null }));
      expect(fieldsOf(e).speciesOther).toEqual(['Describe the species in 1–100 characters.']);
    });

    it('refuses a description on a species that is not Other', async () => {
      const { pets, pet } = await withPet();
      const e = await rejection(pets.update({ id: pet.id, version: 1, speciesOther: 'Tabby' }));
      expect(fieldsOf(e).speciesOther).toEqual([
        'Only add a description when the species is Other.',
      ]);
    });

    it('clears the description when leaving Other', async () => {
      const { pets, pet } = await withPet({ species: 'OTHER', speciesOther: 'Tortoise' });
      const updated = await pets.update({ id: pet.id, version: 1, species: 'DOG' });
      expect(updated).toMatchObject({ species: 'DOG', speciesOther: null });
    });

    it('refuses an estimate without a birth date', async () => {
      const { pets, pet } = await withPet();
      const e = await rejection(pets.update({ id: pet.id, version: 1, birthDateEstimated: true }));
      expect(fieldsOf(e).birthDateEstimated).toEqual(['Add a birth date to mark it as estimated.']);
    });

    it('marks an existing birth date as estimated', async () => {
      const { pets, pet } = await withPet({ birthDate: '2021-03-14' });
      const updated = await pets.update({ id: pet.id, version: 1, birthDateEstimated: true });
      expect(updated.birthDateEstimated).toBe(true);
    });

    it('refuses a measurement date without a weight', async () => {
      const { pets, pet } = await withPet();
      const e = await rejection(
        pets.update({ id: pet.id, version: 1, weightMeasuredOn: '2026-11-01' }),
      );
      expect(fieldsOf(e).weightMeasuredOn).toEqual(['Add a weight for this measurement date.']);
    });

    it('refuses clearing the measurement date of a weight', async () => {
      const { pets, pet } = await withPet({ weight: { value: 4, unit: 'KG' } });
      const e = await rejection(pets.update({ id: pet.id, version: 1, weightMeasuredOn: null }));
      expect(fieldsOf(e).weightMeasuredOn).toEqual(['A weight needs a measurement date.']);
    });

    it('refuses a future measurement date', async () => {
      const { pets, pet } = await withPet({ weight: { value: 4, unit: 'KG' } });
      const e = await rejection(
        pets.update({ id: pet.id, version: 1, weightMeasuredOn: '2026-11-25' }),
      );
      expect(fieldsOf(e).weightMeasuredOn).toEqual([
        "The measurement date can't be in the future.",
      ]);
    });
  });

  it("uses the owner's local date", async () => {
    // 17:00 UTC on 24 Nov is already 25 Nov in Manila.
    const { pets, pet } = await withPet({}, new Date('2026-11-24T17:00:00Z'));
    const updated = await pets.update({ id: pet.id, version: 1, birthDate: '2026-11-25' });
    expect(updated.birthDate).toBe('2026-11-25');
  });

  it('refuses a stale version and writes nothing', async () => {
    const { pets, pet, db } = await withPet();
    await pets.update({ id: pet.id, version: 1, name: 'Mochi II' });
    const e = await rejection(pets.update({ id: pet.id, version: 1, name: 'Mochi III' }));
    expect(e.code).toBe('CONFLICT');
    expect(e.message).toBe(
      'This pet was changed elsewhere. Review the latest version and try again.',
    );
    expect((e.details as { current: Pet }).current).toMatchObject({ name: 'Mochi II', version: 2 });
    expect((await pets.get(pet.id)).name).toBe('Mochi II');
    expect(await petLogs(db)).toHaveLength(2);
  });

  it('refuses a stale version even with no changes', async () => {
    const { pets, pet } = await withPet();
    await pets.update({ id: pet.id, version: 1, name: 'Mochi II' });
    const e = await rejection(pets.update({ id: pet.id, version: 1, name: 'Mochi II' }));
    expect(e.code).toBe('CONFLICT');
  });

  it('returns the pet unchanged for a no-op', async () => {
    const { pets, pet, db } = await withPet();
    expect(await pets.update({ id: pet.id, version: 1, name: 'Mochi', species: 'CAT' })).toEqual(
      pet,
    );
    expect(await petLogs(db)).toHaveLength(1);
  });

  it('refuses archived, unknown, malformed and other-owner pets the same way', async () => {
    const { pets, pet, db } = await withPet();
    const archived = await pets.create({ name: 'Old', species: 'DOG' });
    await db.write(['pets'], (c) =>
      c.run('UPDATE pets SET archived_at = ? WHERE id = ?', [
        '2026-11-24T09:00:00.000Z',
        archived.id,
      ]),
    );
    const other = await addOtherOwnerPet(db);
    for (const id of [archived.id, '01900000-0000-7000-8000-0000000000ff', 'nope', other.petId]) {
      for (const extra of [{ name: 'X' }, { birthDate: '2026-11-25' }]) {
        const e = await rejection(pets.update({ id, version: 1, ...extra }));
        expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
      }
    }
    expect((await pets.get(pet.id)).version).toBe(1);
  });

  it('allows a name another pet has', async () => {
    const { pets, pet } = await withPet();
    await pets.create({ name: 'Rex', species: 'DOG' });
    expect((await pets.update({ id: pet.id, version: 1, name: 'Rex' })).name).toBe('Rex');
  });

  it('writes one pet.updated row with field names only', async () => {
    const { pets, pet, db } = await withPet();
    await pets.update({ id: pet.id, version: 1, name: 'Mochi II', microchip: '985112345678901' });
    const logs = await petLogs(db);
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({ action: 'pet.updated', entity_version: 2 });
    expect(JSON.parse(logs[1].fields).sort()).toEqual(['microchip', 'name']);
    expect(JSON.stringify(logs[1])).not.toContain('Mochi II');
    expect(JSON.stringify(logs[1])).not.toContain('985112345678901');
  });

  it('logs the cleared pair as changed fields', async () => {
    const { pets, pet, db } = await withPet({ weight: { value: 4, unit: 'KG' } });
    await pets.update({ id: pet.id, version: 1, weight: null });
    const logs = await petLogs(db);
    expect(JSON.parse(logs[1].fields).sort()).toEqual(['currentWeightKg', 'weightMeasuredOn']);
  });

  it('rolls back when the change log fails', async () => {
    const { pets, pet, deps } = await withPet();
    vi.spyOn(deps, 'newId').mockReturnValue('bad');
    await expect(pets.update({ id: pet.id, version: 1, name: 'Mochi II' })).rejects.toBeTruthy();
    expect(await pets.get(pet.id)).toEqual(pet);
  });
});
