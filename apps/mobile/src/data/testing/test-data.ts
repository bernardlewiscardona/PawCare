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
    pets: createPetRepository(db, deps),
    ownerId,
  };
}
