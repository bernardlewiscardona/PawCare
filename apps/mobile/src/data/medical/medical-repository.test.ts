import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database';
import { DataError } from '../errors';
import { CHOOSE_EVENT_TYPE, INVALID, NOT_ALLOWED, REQUIRED } from '../shape';
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
const FUTURE = "A medical event can't be in the future. Add planned visits in Appointments.";

async function withPet(now?: Date) {
  const data = await openReadyTestData({ now });
  const pet = await data.pets.create({ name: 'Mochi', species: 'CAT' });
  return { ...data, pet };
}

const counts = (db: Database) =>
  db.read((c) =>
    c.get<{ records: number; medical: number; logs: number }>(
      `SELECT (SELECT count(*) FROM care_records) AS records,
              (SELECT count(*) FROM medical_events) AS medical,
              (SELECT count(*) FROM change_log WHERE entity_type = 'care_record') AS logs`,
    ),
  );

describe('medical repository: create and get', () => {
  it('creates an owner-entered event', async () => {
    const { medical, pet } = await withPet();
    const event = await medical.create({
      petId: pet.id,
      eventType: 'VISIT',
      title: ' Check-up ',
      occurrenceDate: '2026-11-20',
      notes: 'Healthy',
      providerName: 'Dr Cruz',
    });
    expect(event).toEqual({
      id: event.id,
      petId: pet.id,
      eventType: 'VISIT',
      title: 'Check-up',
      occurrenceDate: '2026-11-20',
      notes: 'Healthy',
      providerName: 'Dr Cruz',
      status: 'ACTIVE',
      provenance: 'OWNER_ENTERED',
      voidReason: null,
      voidedAt: null,
      version: 1,
      createdAt: '2026-11-24T08:00:00.000Z',
      updatedAt: '2026-11-24T08:00:00.000Z',
    });
    expect(await medical.get(event.id)).toEqual(event);
  });

  it('accepts every event type', async () => {
    const { medical, pet } = await withPet();
    for (const eventType of [
      'VISIT',
      'DIAGNOSIS',
      'PROCEDURE',
      'ALLERGY',
      'GENERAL_NOTE',
    ] as const) {
      const event = await medical.create({
        petId: pet.id,
        eventType,
        title: 'Entry',
        occurrenceDate: '2026-11-20',
      });
      expect(event.eventType).toBe(eventType);
    }
  });

  it('stores blank notes and provider as null', async () => {
    const { medical, pet } = await withPet();
    const event = await medical.create({
      petId: pet.id,
      eventType: 'GENERAL_NOTE',
      title: 'Unknown history',
      occurrenceDate: '2020-01-01',
      notes: '   ',
      providerName: '',
    });
    expect(event).toMatchObject({ notes: null, providerName: null });
  });

  it('reports every field error at once and writes nothing', async () => {
    const { medical, pet, db } = await withPet();
    const e = await rejection(
      medical.create({
        petId: pet.id,
        eventType: 'VISIT',
        title: '',
        occurrenceDate: '2026-11-25',
        notes: 'a'.repeat(5001),
      }),
    );
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(fieldsOf(e)).sort()).toEqual(['notes', 'occurrenceDate', 'title']);
    expect(fieldsOf(e).occurrenceDate).toEqual([FUTURE]);
    expect(await counts(db)).toEqual({ records: 0, medical: 0, logs: 0 });
  });

  it("uses the owner's local date", async () => {
    // 17:00 UTC on 24 Nov is already 25 Nov in Manila.
    const { medical, pet } = await withPet(new Date('2026-11-24T17:00:00Z'));
    const event = await medical.create({
      petId: pet.id,
      eventType: 'VISIT',
      title: 'Late visit',
      occurrenceDate: '2026-11-25',
    });
    expect(event.occurrenceDate).toBe('2026-11-25');
  });

  it('checks the shape', async () => {
    const { medical, pet } = await withPet();
    const missing = await rejection(medical.create({ petId: pet.id, eventType: 'VISIT' } as never));
    expect(fieldsOf(missing)).toMatchObject({ title: [REQUIRED], occurrenceDate: [REQUIRED] });
    const bad = await rejection(
      medical.create({
        petId: pet.id,
        eventType: 'SURGERY',
        title: 'x',
        occurrenceDate: '2026-11-20',
        ownerId: 'x',
        confirmBeforeBirth: 'yes',
      } as never),
    );
    expect(fieldsOf(bad)).toEqual({
      eventType: [CHOOSE_EVENT_TYPE],
      ownerId: [NOT_ALLOWED],
      confirmBeforeBirth: [INVALID],
    });
  });

  it('saves identical events twice', async () => {
    const { medical, pet } = await withPet();
    const input = {
      petId: pet.id,
      eventType: 'VISIT' as const,
      title: 'Check-up',
      occurrenceDate: '2026-11-20',
    };
    const a = await medical.create(input);
    const b = await medical.create(input);
    expect(a.id).not.toBe(b.id);
  });

  it('refuses archived, unknown, malformed and other-owner pets the same way', async () => {
    const { medical, pets, db } = await withPet();
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
      for (const occurrenceDate of ['2026-11-20', '2026-11-25']) {
        const e = await rejection(
          medical.create({ petId, eventType: 'VISIT', title: 'Check-up', occurrenceDate }),
        );
        expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
      }
    }
    expect(await counts(db)).toEqual({ records: 0, medical: 0, logs: 0 });
  });

  it("get refuses another owner's record and unknown IDs", async () => {
    const { medical, db } = await withPet();
    const other = await addOtherOwnerPet(db);
    const recordId = '01900000-0000-7000-8000-0000000000c1';
    await db.write(['care_records', 'medical_events'], async (c) => {
      await c.run(
        `INSERT INTO care_records (id, owner_id, pet_id, kind, occurrence_date, created_at, updated_at)
         VALUES (?, ?, ?, 'MEDICAL', '2026-11-20', ?, ?)`,
        [
          recordId,
          other.ownerId,
          other.petId,
          '2026-11-24T00:00:00.000Z',
          '2026-11-24T00:00:00.000Z',
        ],
      );
      await c.run(
        `INSERT INTO medical_events (record_id, owner_id, pet_id, event_type, title)
         VALUES (?, ?, ?, 'VISIT', 'Theirs')`,
        [recordId, other.ownerId, other.petId],
      );
    });
    for (const id of [recordId, '01900000-0000-7000-8000-0000000000ff', 'nope']) {
      const e = await rejection(medical.get(id));
      expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
    }
  });

  it('writes one parent, one subtype and one change_log row without health text', async () => {
    const { medical, pet, db } = await withPet();
    await medical.create({
      petId: pet.id,
      eventType: 'DIAGNOSIS',
      title: 'Check-up',
      occurrenceDate: '2026-11-20',
      notes: 'Healthy',
      providerName: 'Dr Cruz',
    });
    expect(await counts(db)).toEqual({ records: 1, medical: 1, logs: 1 });
    const log = await db.read((c) =>
      c.get<{ action: string; entity_version: number; fields: string }>(
        "SELECT * FROM change_log WHERE entity_type = 'care_record'",
      ),
    );
    expect(log).toMatchObject({ action: 'medical_event.created', entity_version: 1 });
    expect(JSON.parse(log!.fields).sort()).toEqual([
      'eventType',
      'notes',
      'occurrenceDate',
      'petId',
      'providerName',
      'title',
    ]);
    for (const text of ['Check-up', 'Healthy', 'Dr Cruz']) {
      expect(JSON.stringify(log)).not.toContain(text);
    }
  });

  it('leaves nothing behind when the change log fails', async () => {
    const { medical, pet, db, deps } = await withPet();
    vi.spyOn(deps, 'newId')
      .mockReturnValueOnce('01900000-0000-7000-8000-0000000000d1')
      .mockReturnValue('bad');
    await expect(
      medical.create({
        petId: pet.id,
        eventType: 'VISIT',
        title: 'Check-up',
        occurrenceDate: '2026-11-20',
      }),
    ).rejects.toBeTruthy();
    expect(await counts(db)).toEqual({ records: 0, medical: 0, logs: 0 });
  });
});
