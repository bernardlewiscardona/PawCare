import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DataError } from '../errors';
import { CHOOSE_SEX, CHOOSE_SPECIES, NOT_ALLOWED, WEIGHT_NUMBER } from '../shape';
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

const fieldsOf = (e: DataError) => (e.details as { fields: Record<string, string[]> }).fields;

async function ready() {
  const data = await openTestData();
  await data.owner.update({ version: 1, displayName: 'Bea', timeZone: 'Asia/Manila' });
  return data;
}

describe('pet repository: create', () => {
  it('creates a minimal pet with defaults', async () => {
    const { pets } = await ready();
    const pet = await pets.create({ name: 'Mochi', species: 'CAT' });
    expect(pet).toEqual({
      id: pet.id,
      name: 'Mochi',
      species: 'CAT',
      speciesOther: null,
      breed: null,
      sex: 'UNKNOWN',
      birthDate: null,
      birthDateEstimated: false,
      currentWeightKg: null,
      weightMeasuredOn: null,
      microchip: null,
      version: 1,
      createdAt: '2026-11-24T08:00:00.000Z',
    });
    expect(await pets.get(pet.id)).toEqual(pet);
  });

  it('converts a weight and defaults the measurement date to today', async () => {
    const { pets } = await ready();
    const pet = await pets.create({
      name: 'Mochi',
      species: 'DOG',
      breed: ' Aspin ',
      sex: 'FEMALE',
      birthDate: '2021-03-14',
      birthDateEstimated: true,
      weight: { value: 22, unit: 'LB' },
      microchip: '985112345678901',
    });
    expect(pet).toMatchObject({
      breed: 'Aspin',
      sex: 'FEMALE',
      birthDate: '2021-03-14',
      birthDateEstimated: true,
      currentWeightKg: 9.979,
      weightMeasuredOn: '2026-11-24',
      microchip: '985112345678901',
    });
  });

  it('checks the species description', async () => {
    const { pets } = await ready();
    const missing = await rejection(pets.create({ name: 'Tok', species: 'OTHER' }));
    expect(fieldsOf(missing).speciesOther).toHaveLength(1);
    const extra = await rejection(pets.create({ name: 'Rex', species: 'DOG', speciesOther: 'x' }));
    expect(fieldsOf(extra).speciesOther).toEqual([
      'Only add a description when the species is Other.',
    ]);
    const ok = await pets.create({ name: 'Tok', species: 'OTHER', speciesOther: 'Tortoise' });
    expect(ok.speciesOther).toBe('Tortoise');
  });

  it('reports every rule error in one VALIDATION_FAILED', async () => {
    const { pets } = await ready();
    const e = await rejection(
      pets.create({
        name: 'Mochi',
        species: 'CAT',
        birthDate: '2026-11-25',
        weight: { value: 0, unit: 'KG' },
        microchip: '!!',
      }),
    );
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.message).toBe('Request validation failed');
    expect(Object.keys(fieldsOf(e)).sort()).toEqual(['birthDate', 'microchip', 'weight']);
  });

  it('asks for a birth date before accepting an estimate', async () => {
    const { pets } = await ready();
    const e = await rejection(
      pets.create({ name: 'Mochi', species: 'CAT', birthDateEstimated: true }),
    );
    expect(fieldsOf(e).birthDateEstimated).toEqual(['Add a birth date to mark it as estimated.']);
  });

  it('reports type errors', async () => {
    const { pets } = await ready();
    const base = { name: 'Mochi', species: 'CAT' };
    expect(
      fieldsOf(
        await rejection(pets.create({ ...base, weight: { value: '4', unit: 'KG' } } as never)),
      ).weight,
    ).toEqual([WEIGHT_NUMBER]);
    expect(
      fieldsOf(await rejection(pets.create({ ...base, species: 'DRAGON' } as never))).species,
    ).toEqual([CHOOSE_SPECIES]);
    expect(fieldsOf(await rejection(pets.create({ ...base, sex: 'X' } as never))).sex).toEqual([
      CHOOSE_SEX,
    ]);
    expect(
      fieldsOf(await rejection(pets.create({ ...base, colour: 'red' } as never))).colour,
    ).toEqual([NOT_ALLOWED]);
    expect(fieldsOf(await rejection(pets.create({ species: 'CAT' } as never))).name).toHaveLength(
      1,
    );
    expect(
      fieldsOf(await rejection(pets.create({ ...base, breed: 5 } as never))).breed,
    ).toHaveLength(1);
  });

  it('needs the profile set up first', async () => {
    const { pets, db } = await openTestData();
    const e = await rejection(pets.create({ name: 'Mochi', species: 'CAT' }));
    expect(e.code).toBe('PROFILE_SETUP_REQUIRED');
    expect(e.message).toBe('Finish setting up your profile before adding a pet.');
    expect((await db.read((c) => c.get<{ n: number }>('SELECT count(*) AS n FROM pets')))!.n).toBe(
      0,
    );
  });

  it('checks setup before validating the body', async () => {
    const { pets, db } = await openTestData();
    const e = await rejection(pets.create({ name: '', species: 'DRAGON' } as never));
    expect(e.code).toBe('PROFILE_SETUP_REQUIRED');
    expect((await db.read((c) => c.get<{ n: number }>('SELECT count(*) AS n FROM pets')))!.n).toBe(
      0,
    );
  });

  it('allows duplicate names', async () => {
    const { pets } = await ready();
    const a = await pets.create({ name: 'Mochi', species: 'CAT' });
    const b = await pets.create({ name: 'Mochi', species: 'CAT' });
    expect(a.id).not.toBe(b.id);
  });

  it('writes one change_log row without health text', async () => {
    const { pets, db } = await ready();
    await pets.create({
      name: 'Mochi',
      species: 'CAT',
      microchip: '985112345678901',
      weight: { value: 4, unit: 'KG' },
    });
    const rows = await db.read((c) =>
      c.all<{ fields: string; action: string }>(
        "SELECT * FROM change_log WHERE entity_type = 'pet'",
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('pet.created');
    expect(JSON.parse(rows[0].fields)).toEqual(
      expect.arrayContaining(['name', 'species', 'microchip', 'currentWeightKg']),
    );
    expect(JSON.stringify(rows[0])).not.toContain('Mochi');
    expect(JSON.stringify(rows[0])).not.toContain('985112345678901');
  });

  it('leaves nothing behind when the transaction fails', async () => {
    const { pets, db, deps } = await ready();
    vi.spyOn(deps, 'newId').mockReturnValue('bad');
    await expect(pets.create({ name: 'Mochi', species: 'CAT' })).rejects.toBeTruthy();
    const counts = await db.read((c) =>
      c.get<{ p: number; l: number }>(
        "SELECT (SELECT count(*) FROM pets) AS p, (SELECT count(*) FROM change_log WHERE entity_type = 'pet') AS l",
      ),
    );
    expect(counts).toEqual({ p: 0, l: 0 });
  });
});

describe('pet repository: list and get', () => {
  it('pages in creation order', async () => {
    const { pets } = await ready();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++)
      ids.push((await pets.create({ name: `P${i}`, species: 'DOG' })).id);
    const first = await pets.list();
    expect(first.data).toHaveLength(20);
    expect(first.nextCursor).toBe(first.data[19].id);
    const second = await pets.list({ cursor: first.nextCursor! });
    expect(second.data).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect([...first.data, ...second.data].map((p) => p.id)).toEqual(ids);
    expect((await pets.list({ limit: 5 })).data).toHaveLength(5);
  });

  it('hides archived pets from the list but not from get', async () => {
    const { pets, db } = await ready();
    const pet = await pets.create({ name: 'Mochi', species: 'CAT' });
    await db.write(['pets'], (c) =>
      c.run('UPDATE pets SET archived_at = ? WHERE id = ?', ['2026-11-24T09:00:00.000Z', pet.id]),
    );
    expect((await pets.list()).data).toEqual([]);
    expect(await pets.get(pet.id)).toEqual(pet);
  });

  it('rejects a bad limit or cursor', async () => {
    const { pets } = await ready();
    for (const limit of [0, 101, 'abc' as never]) {
      expect(fieldsOf(await rejection(pets.list({ limit }))).limit).toEqual([
        'Choose a page size of 1–100.',
      ]);
    }
    expect(fieldsOf(await rejection(pets.list({ cursor: 'nope' }))).cursor).toEqual([
      'Use the nextCursor from the previous page.',
    ]);
  });

  it('answers an unknown or malformed ID with not found', async () => {
    const { pets } = await ready();
    for (const id of [randomUUID(), 'not-a-uuid']) {
      const e = await rejection(pets.get(id));
      expect(e.code).toBe('NOT_FOUND');
      expect(e.message).toBe('Not found');
      expect(e.details).toBeNull();
    }
  });
});
