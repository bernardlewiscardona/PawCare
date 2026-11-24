// Tests only: app code never imports this file.
import { createUuidV7 } from '@pawcare/core';
import { createDatabase, type Database } from '../database';
import type { DataDeps } from '../deps';
import { migrate } from '../migrations';
import {
  createOwnerRepository,
  ensureOwner,
  type OwnerRepository,
} from '../owner/owner-repository';
import { createPetRepository, type PetRepository } from '../pets/pet-repository';
import { openNodeConnection } from './node-sqlite';

export async function openTestData(options: { now?: Date } = {}): Promise<{
  db: Database;
  deps: DataDeps;
  owner: OwnerRepository;
  pets: PetRepository;
  ownerId: string;
}> {
  const db = createDatabase(openNodeConnection());
  await migrate(db);
  const fixed = options.now ?? new Date('2026-11-24T08:00:00Z');
  const deps: DataDeps = {
    newId: createUuidV7((n) => crypto.getRandomValues(new Uint8Array(n))),
    now: () => fixed,
  };
  const ownerId = await db.write(['owners', 'change_log'], (c) => ensureOwner(c, deps));
  return {
    db,
    deps,
    owner: createOwnerRepository(db, deps),
    pets: createPetRepository(db, deps, ownerId),
    ownerId,
  };
}

/**
 * Tests only: adds a second owner and one active pet for them. Drops the single-owner index, so
 * call it only on a throwaway test database.
 */
export async function addOtherOwnerPet(db: Database): Promise<{ ownerId: string; petId: string }> {
  const ownerId = '01900000-0000-7000-8000-00000000000a';
  const petId = '01900000-0000-7000-8000-00000000000b';
  const at = '2026-11-24T00:00:00.000Z';
  await db.write(['owners', 'pets'], async (c) => {
    await c.exec('DROP INDEX owners_single');
    await c.run(
      `INSERT INTO owners (id, display_name, time_zone, profile_completed_at, created_at, updated_at)
       VALUES (?, 'Other', 'UTC', ?, ?, ?)`,
      [ownerId, at, at, at],
    );
    await c.run(
      `INSERT INTO pets (id, owner_id, name, species, created_at, updated_at)
       VALUES (?, ?, 'Other', 'DOG', ?, ?)`,
      [petId, ownerId, at, at],
    );
  });
  return { ownerId, petId };
}
