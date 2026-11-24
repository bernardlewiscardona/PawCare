import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../database';
import type { SqlConnection, SqlValue } from '../sql';
import { openNodeConnection } from '../testing/node-sqlite';
import { migration0001 } from './0001-owner-and-pets';
import { migration0002 } from './0002-pet-selection';
import { migrate } from './index';

const OWNER = '01900000-0000-7000-8000-000000000001';
const OTHER_OWNER = '01900000-0000-7000-8000-000000000009';
const PET = '01900000-0000-7000-8000-000000000002';
const RECORD = '01900000-0000-7000-8000-000000000003';
const NOW = '2026-11-24T00:00:00.000Z';

let conn: SqlConnection;
let db: Database;

beforeEach(async () => {
  conn = openNodeConnection();
  db = createDatabase(conn);
  await migrate(db);
});

function insert(table: string, row: Record<string, SqlValue>) {
  const keys = Object.keys(row);
  return conn.run(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => row[k]!),
  );
}

const addOwner = (id = OWNER) => insert('owners', { id, created_at: NOW, updated_at: NOW });
const addPet = (ownerId = OWNER) =>
  insert('pets', {
    id: PET,
    owner_id: ownerId,
    name: 'Rex',
    species: 'DOG',
    created_at: NOW,
    updated_at: NOW,
  });
const addRecord = (cols: Record<string, SqlValue> = {}) =>
  insert('care_records', {
    id: RECORD,
    owner_id: OWNER,
    pet_id: PET,
    kind: 'MEDICAL',
    occurrence_date: '2026-11-20',
    created_at: NOW,
    updated_at: NOW,
    ...cols,
  });
const addMedical = (cols: Record<string, SqlValue> = {}) =>
  insert('medical_events', {
    record_id: RECORD,
    owner_id: OWNER,
    pet_id: PET,
    event_type: 'VISIT',
    title: 'Check-up',
    ...cols,
  });

describe('care_records', () => {
  beforeEach(async () => {
    await addOwner();
    await addPet();
  });

  it('accepts a medical record and its subtype row', async () => {
    await addRecord();
    await addMedical({ notes: 'Healthy', provider_name: 'Dr Cruz' });
    const row = await conn.get<{ status: string; provenance: string; version: number }>(
      'SELECT status, provenance, version FROM care_records',
    );
    expect(row).toEqual({ status: 'ACTIVE', provenance: 'OWNER_ENTERED', version: 1 });
  });

  it('rejects an unknown kind', async () => {
    await expect(addRecord({ kind: 'X' })).rejects.toThrow(/CHECK/);
  });

  it('rejects VOIDED without a reason and time', async () => {
    await expect(addRecord({ status: 'VOIDED' })).rejects.toThrow(/CHECK/);
  });

  it('rejects ACTIVE with a void reason', async () => {
    await expect(addRecord({ void_reason: 'typo' })).rejects.toThrow(/CHECK/);
  });

  it('accepts a voided medical record but never a voided appointment', async () => {
    const voided = { status: 'VOIDED', void_reason: 'Wrong pet', voided_at: NOW };
    await expect(addRecord({ kind: 'APPOINTMENT', ...voided })).rejects.toThrow(/CHECK/);
    await addRecord(voided);
  });

  it('rejects any provenance but OWNER_ENTERED', async () => {
    await expect(addRecord({ provenance: 'VERIFIED' })).rejects.toThrow(/CHECK/);
  });

  it('rejects an impossible date', async () => {
    await expect(addRecord({ occurrence_date: '2026-02-30' })).rejects.toThrow(/CHECK/);
  });

  it("rejects a record for another owner's pet", async () => {
    await conn.exec('DROP INDEX owners_single');
    await addOwner(OTHER_OWNER);
    await expect(addRecord({ owner_id: OTHER_OWNER })).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('medical_events', () => {
  beforeEach(async () => {
    await addOwner();
    await addPet();
  });

  it('rejects a parent of another kind', async () => {
    await addRecord({ kind: 'VACCINE' });
    await expect(addMedical()).rejects.toThrow(/FOREIGN KEY/);
  });

  it('rejects a subtype kind other than MEDICAL', async () => {
    await addRecord();
    await expect(addMedical({ kind: 'VACCINE' })).rejects.toThrow(/CHECK/);
  });

  it('rejects a blank title', async () => {
    await addRecord();
    await expect(addMedical({ title: '  ' })).rejects.toThrow(/CHECK/);
  });

  it('counts title length in code points', async () => {
    await addRecord();
    await expect(addMedical({ title: '🐾'.repeat(151) })).rejects.toThrow(/CHECK/);
    await addMedical({ title: '🐾'.repeat(150) });
  });

  it('rejects notes over 5,000 characters', async () => {
    await addRecord();
    await expect(addMedical({ notes: 'a'.repeat(5001) })).rejects.toThrow(/CHECK/);
  });

  it('rejects an empty provider', async () => {
    await addRecord();
    await expect(addMedical({ provider_name: '' })).rejects.toThrow(/CHECK/);
  });
});

describe('change_log after 0003', () => {
  const log = (id: string, entityType: string) =>
    insert('change_log', {
      id,
      owner_id: OWNER,
      entity_type: entityType,
      entity_id: RECORD,
      entity_version: 1,
      action: 'medical_event.created',
      fields: '[]',
      occurred_at: NOW,
    });

  beforeEach(() => addOwner());

  it("accepts 'care_record' and still rejects unknown entity types", async () => {
    await log('01900000-0000-7000-8000-0000000000a1', 'care_record');
    await expect(log('01900000-0000-7000-8000-0000000000a2', 'x')).rejects.toThrow(/CHECK/);
  });

  it('is still append-only', async () => {
    await log('01900000-0000-7000-8000-0000000000a1', 'care_record');
    await expect(conn.run("UPDATE change_log SET action = 'x'")).rejects.toThrow(/append-only/);
    await expect(conn.run('DELETE FROM change_log')).rejects.toThrow(/append-only/);
  });
});

describe('upgrade from version 2', () => {
  it('keeps every change_log row', async () => {
    const old = openNodeConnection();
    await old.exec(migration0001.sql);
    await old.exec(migration0002.sql);
    await old.exec('PRAGMA user_version = 2');
    await old.run('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)', [
      OWNER,
      NOW,
      NOW,
    ]);
    for (const [id, type] of [
      ['01900000-0000-7000-8000-0000000000b1', 'owner'],
      ['01900000-0000-7000-8000-0000000000b2', 'pet'],
    ]) {
      await old.run(
        `INSERT INTO change_log (id, owner_id, entity_type, entity_id, entity_version, action, fields, occurred_at)
         VALUES (?, ?, ?, ?, 1, 'created', '["name"]', ?)`,
        [id, OWNER, type, OWNER, NOW],
      );
    }
    const before = await old.all('SELECT * FROM change_log ORDER BY id');

    expect(await migrate(createDatabase(old))).toEqual({ from: 2, to: 3 });
    expect(await old.all('SELECT * FROM change_log ORDER BY id')).toEqual(before);
    await expect(old.run('DELETE FROM change_log')).rejects.toThrow(/append-only/);
  });
});
