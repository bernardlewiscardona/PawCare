import { normalizePetName, isRuleError } from '@pawcare/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../database';
import type { SqlConnection } from '../sql';
import { openNodeConnection } from '../testing/node-sqlite';
import { MigrationTooNewError, migrate } from './index';

const OWNER = '01900000-0000-7000-8000-000000000001';
const PET = '01900000-0000-7000-8000-000000000002';
const NOW = '2026-11-24T00:00:00.000Z';

let conn: SqlConnection;
let db: Database;

beforeEach(async () => {
  conn = openNodeConnection();
  db = createDatabase(conn);
  await migrate(db);
});

const addOwner = () =>
  conn.run(`INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)`, [OWNER, NOW, NOW]);

function addPet(cols: Record<string, string | number | null> = {}, ownerId = OWNER) {
  const row: Record<string, string | number | null> = {
    id: PET,
    owner_id: ownerId,
    name: 'Rex',
    species: 'DOG',
    created_at: NOW,
    updated_at: NOW,
    ...cols,
  };
  const keys = Object.keys(row);
  return conn.run(
    `INSERT INTO pets (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => row[k]!),
  );
}

describe('migrate', () => {
  it('applies every migration once', async () => {
    const fresh = createDatabase(openNodeConnection());
    expect(await migrate(fresh)).toEqual({ from: 0, to: 2 });
    expect(await fresh.read((c) => c.get('PRAGMA user_version'))).toEqual({ user_version: 2 });
    expect(await migrate(fresh)).toEqual({ from: 2, to: 2 });
  });

  it('refuses a database from a newer app', async () => {
    await conn.exec('PRAGMA user_version = 99');
    await expect(migrate(db)).rejects.toBeInstanceOf(MigrationTooNewError);
  });
});

describe('schema constraints', () => {
  it('rejects a second owner', async () => {
    await addOwner();
    await expect(
      conn.run('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)', [
        '01900000-0000-7000-8000-000000000009',
        NOW,
        NOW,
      ]),
    ).rejects.toThrow();
  });

  it('rejects a pet with an unknown owner', async () => {
    await addOwner();
    await expect(addPet({}, '01900000-0000-7000-8000-000000000009')).rejects.toThrow();
  });

  it('rejects DOG with species_other', async () => {
    await addOwner();
    await expect(addPet({ species_other: 'x' })).rejects.toThrow();
  });

  it('rejects OTHER without species_other', async () => {
    await addOwner();
    await expect(addPet({ species: 'OTHER' })).rejects.toThrow();
  });

  it('rejects a zero weight', async () => {
    await addOwner();
    await expect(addPet({ current_weight_g: 0 })).rejects.toThrow();
  });

  it('rejects an impossible birth date', async () => {
    await addOwner();
    await expect(addPet({ birth_date: '2026-02-30' })).rejects.toThrow();
  });

  it('rejects weight_measured_on without a weight', async () => {
    await addOwner();
    await expect(addPet({ weight_measured_on: '2026-01-01' })).rejects.toThrow();
  });

  it('rejects an estimated birth date without a date', async () => {
    await addOwner();
    await expect(addPet({ birth_date_estimated: 1 })).rejects.toThrow();
  });

  it('rejects a completed profile without a display name', async () => {
    await expect(
      conn.run(
        'INSERT INTO owners (id, created_at, updated_at, profile_completed_at) VALUES (?, ?, ?, ?)',
        [OWNER, NOW, NOW, NOW],
      ),
    ).rejects.toThrow();
  });

  it('rejects UPDATE on change_log', async () => {
    await addOwner();
    await insertLog();
    await expect(conn.run("UPDATE change_log SET action = 'x'")).rejects.toThrow(/append-only/);
  });

  it('rejects DELETE on change_log', async () => {
    await addOwner();
    await insertLog();
    await expect(conn.run('DELETE FROM change_log')).rejects.toThrow(/append-only/);
  });

  it('counts pet names in code points, like core', async () => {
    await addOwner();
    const ok = '🐾'.repeat(100);
    const tooLong = '🐾'.repeat(101);
    expect(isRuleError(normalizePetName(ok))).toBe(false);
    expect(isRuleError(normalizePetName(tooLong))).toBe(true);
    await addPet({ name: ok });
    await expect(
      addPet({ id: '01900000-0000-7000-8000-000000000003', name: tooLong }),
    ).rejects.toThrow();
  });
});

describe('pet_selection', () => {
  const OTHER_OWNER = '01900000-0000-7000-8000-000000000009';
  const select = (ownerId = OWNER, petId = PET) =>
    conn.run('INSERT INTO pet_selection (owner_id, pet_id, selected_at) VALUES (?, ?, ?)', [
      ownerId,
      petId,
      NOW,
    ]);

  it("accepts the owner's own pet", async () => {
    await addOwner();
    await addPet();
    await expect(select()).resolves.toBeTruthy();
  });

  it("rejects another owner's pet", async () => {
    await conn.exec('DROP INDEX owners_single');
    await addOwner();
    await conn.run('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)', [
      OTHER_OWNER,
      NOW,
      NOW,
    ]);
    await addPet({}, OTHER_OWNER);
    await expect(select()).rejects.toThrow(/FOREIGN KEY/);
  });

  it('rejects an unknown pet', async () => {
    await addOwner();
    await expect(select()).rejects.toThrow(/FOREIGN KEY/);
  });

  it('keeps one row per owner', async () => {
    await addOwner();
    await addPet();
    await select();
    await expect(select()).rejects.toThrow(/UNIQUE/);
  });
});

function insertLog() {
  return conn.run(
    `INSERT INTO change_log (id, owner_id, entity_type, entity_id, entity_version, action, fields, occurred_at)
     VALUES (?, ?, 'owner', ?, 1, 'create', '{}', ?)`,
    ['01900000-0000-7000-8000-0000000000aa', OWNER, OWNER, NOW],
  );
}
