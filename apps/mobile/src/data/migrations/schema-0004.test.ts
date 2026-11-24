import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../database';
import type { SqlConnection, SqlValue } from '../sql';
import { openNodeConnection } from '../testing/node-sqlite';
import { migrate } from './index';

const OWNER = '01900000-0000-7000-8000-000000000001';
const OTHER_OWNER = '01900000-0000-7000-8000-000000000009';
const PET = '01900000-0000-7000-8000-000000000002';
const RECORD = '01900000-0000-7000-8000-000000000003';
const RECORD2 = '01900000-0000-7000-8000-000000000004';
const DUE = '01900000-0000-7000-8000-000000000005';
const DUE2 = '01900000-0000-7000-8000-000000000006';
const NOW = '2026-11-24T00:00:00.000Z';

let conn: SqlConnection;

beforeEach(async () => {
  conn = openNodeConnection();
  await migrate(createDatabase(conn));
  await insert('owners', { id: OWNER, created_at: NOW, updated_at: NOW });
  await insert('pets', {
    id: PET,
    owner_id: OWNER,
    name: 'Rex',
    species: 'DOG',
    created_at: NOW,
    updated_at: NOW,
  });
  for (const id of [RECORD, RECORD2]) await addParent(id, 'VACCINE');
});

function insert(table: string, row: Record<string, SqlValue>) {
  const keys = Object.keys(row);
  return conn.run(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => row[k]!),
  );
}

const addParent = (id: string, kind: string) =>
  insert('care_records', {
    id,
    owner_id: OWNER,
    pet_id: PET,
    kind,
    occurrence_date: '2026-11-20',
    created_at: NOW,
    updated_at: NOW,
  });
const addVaccination = (cols: Record<string, SqlValue> = {}) =>
  insert('vaccinations', {
    record_id: RECORD,
    owner_id: OWNER,
    pet_id: PET,
    vaccine_name: 'Rabies',
    administered_on: '2026-11-20',
    ...cols,
  });
const addDue = (cols: Record<string, SqlValue> = {}) =>
  insert('vaccine_due_items', {
    id: DUE,
    owner_id: OWNER,
    pet_id: PET,
    vaccination_id: RECORD,
    due_on: '2027-11-20',
    created_at: NOW,
    updated_at: NOW,
    ...cols,
  });

describe('vaccinations', () => {
  it('accepts a vaccination and a due item for it', async () => {
    await addVaccination({ provider_name: 'Dr Cruz', batch_label: 'A12' });
    await addDue();
    const due = await conn.get<{ schedule_version: number; version: number }>(
      'SELECT schedule_version, version FROM vaccine_due_items',
    );
    expect(due).toEqual({ schedule_version: 1, version: 1 });
  });

  it('rejects a parent of another kind', async () => {
    const MEDICAL = '01900000-0000-7000-8000-000000000007';
    await addParent(MEDICAL, 'MEDICAL');
    await expect(addVaccination({ record_id: MEDICAL })).rejects.toThrow(/FOREIGN KEY/);
  });

  it('rejects a subtype kind other than VACCINE', async () => {
    await expect(addVaccination({ kind: 'MEDICAL' })).rejects.toThrow(/CHECK/);
  });

  it('checks the name, provider and batch', async () => {
    await expect(addVaccination({ vaccine_name: '  ' })).rejects.toThrow(/CHECK/);
    await expect(addVaccination({ vaccine_name: '🐾'.repeat(151) })).rejects.toThrow(/CHECK/);
    await expect(addVaccination({ provider_name: '' })).rejects.toThrow(/CHECK/);
    await expect(addVaccination({ batch_label: '' })).rejects.toThrow(/CHECK/);
    await expect(addVaccination({ batch_label: 'a'.repeat(101) })).rejects.toThrow(/CHECK/);
    await addVaccination({ vaccine_name: '🐾'.repeat(150) });
  });

  it('rejects an impossible administration date', async () => {
    for (const administered_on of ['2026-02-30', '2026-13-01', '2026-1-1']) {
      await expect(addVaccination({ administered_on })).rejects.toThrow(/CHECK/);
    }
  });
});

describe('vaccine_due_items', () => {
  beforeEach(() => addVaccination());

  it('rejects a due item for an unknown vaccination', async () => {
    await expect(addDue({ vaccination_id: RECORD2 })).rejects.toThrow(/FOREIGN KEY/);
  });

  it("rejects a due item for another owner's pet", async () => {
    await conn.exec('DROP INDEX owners_single');
    await insert('owners', { id: OTHER_OWNER, created_at: NOW, updated_at: NOW });
    await expect(addDue({ owner_id: OTHER_OWNER })).rejects.toThrow(/FOREIGN KEY/);
  });

  it('rejects an impossible due date', async () => {
    await expect(addDue({ due_on: '2026-13-01' })).rejects.toThrow(/CHECK/);
  });

  it('rejects a vaccination fulfilling its own due item', async () => {
    await expect(addDue({ fulfilled_by_vaccination_id: RECORD })).rejects.toThrow(/CHECK/);
  });

  it('keeps one due item per vaccination', async () => {
    await addDue();
    await expect(addDue({ id: DUE2 })).rejects.toThrow(/UNIQUE/);
  });

  it('lets a vaccination fulfil at most one due item', async () => {
    await addVaccination({ record_id: RECORD2 });
    const THIRD = '01900000-0000-7000-8000-000000000008';
    await addParent(THIRD, 'VACCINE');
    await addVaccination({ record_id: THIRD });
    await addDue({ fulfilled_by_vaccination_id: THIRD });
    await expect(
      addDue({ id: DUE2, vaccination_id: RECORD2, fulfilled_by_vaccination_id: THIRD }),
    ).rejects.toThrow(/UNIQUE/);
  });
});
