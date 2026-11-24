import { describe, expect, it } from 'vitest';
import { DataError } from '../errors';
import { openReadyTestData } from '../testing/test-data';
import type { CreatePetInput } from '../types';

async function rejection(p: Promise<unknown>): Promise<DataError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    return e as DataError;
  }
  throw new Error('expected rejection');
}

async function withPet(pet: Partial<CreatePetInput> = { birthDate: '2021-03-14' }) {
  const data = await openReadyTestData();
  const created = await data.pets.create({ name: 'Mochi', species: 'CAT', ...pet });
  const event = (occurrenceDate: string, extra: Record<string, unknown> = {}) =>
    data.medical.create({
      petId: created.id,
      eventType: 'VISIT',
      title: 'Check-up',
      occurrenceDate,
      ...extra,
    });
  return { ...data, event };
}

const recordCount = async (db: Awaited<ReturnType<typeof openReadyTestData>>['db']) =>
  (await db.read((c) => c.get<{ n: number }>('SELECT count(*) AS n FROM care_records')))!.n;

describe('medical events before birth', () => {
  it('asks before saving a date before birth', async () => {
    const { event, db } = await withPet();
    const e = await rejection(event('2021-03-13'));
    expect(e.code).toBe('CONFIRMATION_REQUIRED');
    expect(e.message).toBe('Confirmation required');
    expect(e.details).toEqual({
      warnings: { occurrenceDate: ["This date is before Mochi's birth date. Save anyway?"] },
    });
    expect(await recordCount(db)).toBe(0);
  });

  it('saves when confirmed', async () => {
    const { event } = await withPet();
    const saved = await event('2021-03-13', { confirmBeforeBirth: true });
    expect(saved.occurrenceDate).toBe('2021-03-13');
  });

  it('warns for an estimated birth date too', async () => {
    const { event } = await withPet({ birthDate: '2021-03-14', birthDateEstimated: true });
    expect((await rejection(event('2020-01-01'))).code).toBe('CONFIRMATION_REQUIRED');
  });

  it('does not warn on the birth date itself', async () => {
    const { event } = await withPet();
    expect((await event('2021-03-14')).occurrenceDate).toBe('2021-03-14');
  });

  it('does not warn for a pet with no birth date', async () => {
    const { event } = await withPet({});
    expect((await event('1990-01-01')).occurrenceDate).toBe('1990-01-01');
  });

  it('reports field errors before the warning', async () => {
    const { event } = await withPet();
    const e = await rejection(event('2021-03-13', { title: '' }));
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(Object.keys((e.details as { fields: object }).fields)).toEqual(['title']);
  });
});
