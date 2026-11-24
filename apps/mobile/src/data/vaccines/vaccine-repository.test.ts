import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database';
import { DataError } from '../errors';
import { INVALID, NOT_ALLOWED, REQUIRED } from '../shape';
import { addOtherOwnerPet, openReadyTestData } from '../testing/test-data';
import { createVaccineRepository } from './vaccine-repository';

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

async function withPet(now?: Date) {
  const data = await openReadyTestData({ now });
  const pet = await data.pets.create({ name: 'Mochi', species: 'CAT', birthDate: '2019-03-14' });
  return { ...data, pet };
}

const counts = (db: Database) =>
  db.read((c) =>
    c.get<{ records: number; vaccinations: number; due: number; logs: number }>(
      `SELECT (SELECT count(*) FROM care_records) AS records,
              (SELECT count(*) FROM vaccinations) AS vaccinations,
              (SELECT count(*) FROM vaccine_due_items) AS due,
              (SELECT count(*) FROM change_log WHERE entity_type = 'care_record') AS logs`,
    ),
  );

describe('vaccine repository: create and get', () => {
  it('records a vaccine with a next due date', async () => {
    const { vaccines, pet, db, ownerId } = await withPet();
    const v = await vaccines.create({
      petId: pet.id,
      vaccineName: ' Rabies ',
      administeredOn: '2026-11-20',
      providerName: 'Dr Cruz',
      batchLabel: 'A12',
      nextDueOn: '2027-11-20',
    });
    expect(v).toEqual({
      id: v.id,
      petId: pet.id,
      vaccineName: 'Rabies',
      administeredOn: '2026-11-20',
      providerName: 'Dr Cruz',
      batchLabel: 'A12',
      nextDue: { id: expect.any(String), dueOn: '2027-11-20', overdue: false },
      status: 'ACTIVE',
      provenance: 'OWNER_ENTERED',
      voidReason: null,
      voidedAt: null,
      version: 1,
      createdAt: '2026-11-24T08:00:00.000Z',
      updatedAt: '2026-11-24T08:00:00.000Z',
    });
    expect(await vaccines.get(v.id)).toEqual(v);
    const parent = await db.read((c) =>
      c.get<{ occurrence_date: string; kind: string }>(
        'SELECT occurrence_date, kind FROM care_records WHERE id = ?',
        [v.id],
      ),
    );
    expect(parent).toEqual({ occurrence_date: '2026-11-20', kind: 'VACCINE' });
    const due = await db.read((c) =>
      c.get<{ id: string; owner_id: string; pet_id: string; vaccination_id: string }>(
        'SELECT id, owner_id, pet_id, vaccination_id FROM vaccine_due_items',
      ),
    );
    expect(due).toEqual({
      id: v.nextDue!.id,
      owner_id: ownerId,
      pet_id: pet.id,
      vaccination_id: v.id,
    });
  });

  it('infers nothing without a due date', async () => {
    const { vaccines, pet, db } = await withPet();
    const v = await vaccines.create({
      petId: pet.id,
      vaccineName: 'Rabies',
      administeredOn: '2026-11-20',
    });
    expect(v).toMatchObject({ nextDue: null, providerName: null, batchLabel: null });
    expect((await counts(db))!.due).toBe(0);
  });

  it('marks a past due date overdue', async () => {
    const { vaccines, pet } = await withPet();
    const v = await vaccines.create({
      petId: pet.id,
      vaccineName: 'Rabies',
      administeredOn: '2020-01-01',
      nextDueOn: '2021-01-01',
    });
    expect(v.nextDue).toMatchObject({ dueOn: '2021-01-01', overdue: true });
  });

  it("is not overdue on the due date itself, in the owner's zone", async () => {
    const { vaccines, pet, db, deps, ownerId } = await withPet();
    const v = await vaccines.create({
      petId: pet.id,
      vaccineName: 'Rabies',
      administeredOn: '2025-11-24',
      nextDueOn: '2026-11-24',
    });
    expect(v.nextDue!.overdue).toBe(false);
    // 17:00 UTC on 24 Nov is already 25 Nov in Manila.
    const later = createVaccineRepository(
      db,
      { ...deps, now: () => new Date('2026-11-24T17:00:00Z') },
      ownerId,
    );
    expect((await later.get(v.id)).nextDue!.overdue).toBe(true);
  });

  it('blocks a due date before the vaccination date and allows the same day', async () => {
    const { vaccines, pet } = await withPet();
    const e = await rejection(
      vaccines.create({
        petId: pet.id,
        vaccineName: 'Rabies',
        administeredOn: '2026-11-20',
        nextDueOn: '2026-11-19',
      }),
    );
    expect(fieldsOf(e).nextDueOn).toEqual([
      "The next due date can't be before the vaccination date.",
    ]);
    const same = await vaccines.create({
      petId: pet.id,
      vaccineName: 'Rabies',
      administeredOn: '2026-11-20',
      nextDueOn: '2026-11-20',
    });
    expect(same.nextDue!.dueOn).toBe('2026-11-20');
  });

  it('reports every field error at once and writes nothing', async () => {
    const { vaccines, pet, db } = await withPet();
    const e = await rejection(
      vaccines.create({
        petId: pet.id,
        vaccineName: '',
        administeredOn: '2026-11-25',
        batchLabel: 'a'.repeat(101),
      }),
    );
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(fieldsOf(e)).sort()).toEqual([
      'administeredOn',
      'batchLabel',
      'vaccineName',
    ]);
    expect(fieldsOf(e).administeredOn).toEqual(["The vaccination date can't be in the future."]);
    expect(await counts(db)).toEqual({ records: 0, vaccinations: 0, due: 0, logs: 0 });
  });

  it('checks the shape', async () => {
    const { vaccines, pet } = await withPet();
    const e = await rejection(
      vaccines.create({
        petId: pet.id,
        administeredOn: '2026-11-20',
        confirmSimilar: 'yes',
        ownerId: 'x',
      } as never),
    );
    expect(fieldsOf(e)).toEqual({
      vaccineName: [REQUIRED],
      confirmSimilar: [INVALID],
      ownerId: [NOT_ALLOWED],
    });
  });

  it('refuses archived, unknown, malformed and other-owner pets the same way', async () => {
    const { vaccines, pets, db } = await withPet();
    const archived = await pets.create({ name: 'Old', species: 'DOG' });
    await db.write(['pets'], (c) =>
      c.run('UPDATE pets SET archived_at = ? WHERE id = ?', [
        '2026-11-24T09:00:00.000Z',
        archived.id,
      ]),
    );
    const other = await addOtherOwnerPet(db);
    for (const petId of [
      archived.id,
      '01900000-0000-7000-8000-0000000000ff',
      'nope',
      other.petId,
    ]) {
      for (const administeredOn of ['2026-11-20', '2026-11-25']) {
        const e = await rejection(
          vaccines.create({ petId, vaccineName: 'Rabies', administeredOn }),
        );
        expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
      }
    }
    expect(await counts(db)).toEqual({ records: 0, vaccinations: 0, due: 0, logs: 0 });
  });

  it("get refuses another owner's record and unknown IDs", async () => {
    const { vaccines, db } = await withPet();
    const other = await addOtherOwnerPet(db);
    const theirs = '01900000-0000-7000-8000-0000000000c1';
    await db.write(['care_records', 'vaccinations'], async (c) => {
      await c.run(
        `INSERT INTO care_records (id, owner_id, pet_id, kind, occurrence_date, created_at, updated_at)
         VALUES (?, ?, ?, 'VACCINE', '2026-11-20', ?, ?)`,
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
         VALUES (?, ?, ?, 'Theirs', '2026-11-20')`,
        [theirs, other.ownerId, other.petId],
      );
    });
    for (const id of [theirs, '01900000-0000-7000-8000-0000000000ff', 'nope']) {
      const e = await rejection(vaccines.get(id));
      expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
    }
  });

  it('writes one change_log row without vaccine text', async () => {
    const { vaccines, pet, db } = await withPet();
    await vaccines.create({
      petId: pet.id,
      vaccineName: 'Rabies',
      administeredOn: '2026-11-20',
      providerName: 'Dr Cruz',
      batchLabel: 'A12',
      nextDueOn: '2027-11-20',
    });
    expect(await counts(db)).toEqual({ records: 1, vaccinations: 1, due: 1, logs: 1 });
    const log = await db.read((c) =>
      c.get<{ action: string; entity_version: number; fields: string }>(
        "SELECT * FROM change_log WHERE entity_type = 'care_record'",
      ),
    );
    expect(log).toMatchObject({ action: 'vaccination.created', entity_version: 1 });
    expect(JSON.parse(log!.fields).sort()).toEqual([
      'administeredOn',
      'batchLabel',
      'nextDueOn',
      'petId',
      'providerName',
      'vaccineName',
    ]);
    for (const text of ['Rabies', 'A12', 'Dr Cruz'])
      expect(JSON.stringify(log)).not.toContain(text);
  });

  it('leaves nothing behind when the change log fails', async () => {
    const { vaccines, pet, db, deps } = await withPet();
    const spy = vi
      .spyOn(deps, 'newId')
      .mockReturnValueOnce('01900000-0000-7000-8000-0000000000d1')
      .mockReturnValueOnce('01900000-0000-7000-8000-0000000000d2')
      .mockReturnValue('bad');
    await expect(
      vaccines.create({
        petId: pet.id,
        vaccineName: 'Rabies',
        administeredOn: '2026-11-20',
        nextDueOn: '2027-11-20',
      }),
    ).rejects.toThrow(/CHECK/);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(await counts(db)).toEqual({ records: 0, vaccinations: 0, due: 0, logs: 0 });
  });
});
