import { createUuidV7 } from '@pawcare/core';
import { createDatabase, type Database } from './database';
import type { DataDeps } from './deps';
import { MigrationTooNewError, migrate } from './migrations';
import { createOwnerRepository, ensureOwner, type OwnerRepository } from './owner/owner-repository';
import { createPetRepository, type PetRepository } from './pets/pet-repository';
import { createMedicalRepository, type MedicalRepository } from './medical/medical-repository';
import type { SqlConnection } from './sql';

export const DB_NAME = 'pawcare.db';
export const KEY_NAME = 'pawcare-db-key';

const KEY_BYTES = 32;
const KEY_PATTERN = /^[0-9a-f]{64}$/;
// Every SQLite sidecar: the default rollback journal, and WAL's two files.
const DB_SUFFIXES = ['', '-journal', '-wal', '-shm'] as const;

/** Everything opening needs from the platform. `expo-env.ts` wires the real one; tests fake it. */
export interface OpenEnv {
  isExpoGo: boolean;
  isDev: boolean;
  keys: {
    get(name: string): Promise<string | null>;
    set(name: string, value: string): Promise<void>;
  };
  /** Names are plain file names inside the database directory. There is deliberately no delete. */
  files: {
    exists(name: string): Promise<boolean>;
    rename(from: string, to: string): Promise<void>;
  };
  connect(name: string): Promise<SqlConnection>;
  randomBytes(n: number): Uint8Array;
  now(): Date;
}

export interface PawCareData {
  owner: OwnerRepository;
  pets: PetRepository;
  medical: MedicalRepository;
  subscribe: Database['subscribe'];
  close(): Promise<void>;
}

export type OpenResult =
  | { state: 'ready'; encrypted: boolean; userVersion: number; data: PawCareData }
  | { state: 'encryption-unavailable' }
  | { state: 'too-new' }
  | { state: 'key-missing'; startFresh(): Promise<OpenResult> }
  | { state: 'failed'; startFresh(): Promise<OpenResult>; retry(): Promise<OpenResult> };

type Step =
  | 'key-store'
  | 'connect'
  | 'key'
  | 'cipher-check'
  | 'user-version'
  | 'migrate'
  | 'owner'
  | 'start-fresh';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function newKey(env: OpenEnv): string {
  const bytes = env.randomBytes(KEY_BYTES);
  if (bytes.length !== KEY_BYTES) throw new Error('Short random read');
  return toHex(bytes);
}

/** `YYYYMMDDTHHmmssSSSZ` in UTC, safe in file names and secure-store keys. */
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '');
}

/** Only the step and the error's class name: never its message, a path, a key or a value. */
function logFailure(step: Step, error: unknown): void {
  console.warn(`[data] open failed at ${step}:`, error instanceof Error ? error.name : 'unknown');
}

async function closeQuietly(connection: SqlConnection | undefined): Promise<void> {
  try {
    await connection?.close();
  } catch {
    // Already failing or refusing; a close error adds nothing the caller can act on.
  }
}

/**
 * The Start fresh or Try again that is running, if any. There is one database, so a second call
 * while one runs (a double tap, a stale alert) joins it instead of racing it on the renames and
 * keys. Shared by both actions, since a retry would otherwise open the file mid-rename.
 */
let recovery: Promise<OpenResult> | undefined;

function singleFlight(run: () => Promise<OpenResult>): Promise<OpenResult> {
  recovery ??= run().finally(() => {
    recovery = undefined;
  });
  return recovery;
}

function failed(env: OpenEnv): OpenResult {
  return {
    state: 'failed',
    startFresh: () => singleFlight(() => startFresh(env)),
    retry: () => singleFlight(() => openPawCareData(env)),
  };
}

/**
 * Opens the phone database. A release or development build only ever opens it encrypted; the
 * one exception is Expo Go in development, which can't load SQLCipher. Never deletes a file or key.
 */
export async function openPawCareData(env: OpenEnv): Promise<OpenResult> {
  const encrypted = !(env.isExpoGo && env.isDev);
  let step: Step = 'key-store';
  let connection: SqlConnection | undefined;
  try {
    let key: string | null = null;
    if (encrypted) {
      key = await env.keys.get(KEY_NAME);
      if (key === null && (await env.files.exists(DB_NAME))) {
        return { state: 'key-missing', startFresh: () => singleFlight(() => startFresh(env)) };
      }
      if (key === null) {
        key = newKey(env);
        await env.keys.set(KEY_NAME, key);
      }
    }

    step = 'connect';
    connection = await env.connect(DB_NAME);

    if (encrypted) {
      step = 'key';
      // The only SQL built from a value: PRAGMA takes no bound parameters. The key is app-made
      // hex, and anything else is refused before it can reach SQLite.
      if (key === null || !KEY_PATTERN.test(key)) throw new Error('Malformed key');
      await connection.exec(`PRAGMA key = "x'${key}'"`);

      step = 'cipher-check';
      // Without SQLCipher, PRAGMA key is silently ignored and this returns no row.
      const cipher = await connection.get<{ cipher_version?: string }>('PRAGMA cipher_version');
      if (!cipher?.cipher_version) {
        await closeQuietly(connection);
        return { state: 'encryption-unavailable' };
      }
    }

    step = 'user-version';
    await connection.exec('PRAGMA foreign_keys = ON');
    // The first read of the file: a wrong key fails here.
    await connection.get<{ user_version: number }>('PRAGMA user_version');

    const db = createDatabase(connection);
    step = 'migrate';
    let userVersion: number;
    try {
      ({ to: userVersion } = await migrate(db));
    } catch (error) {
      if (error instanceof MigrationTooNewError) {
        await closeQuietly(connection);
        return { state: 'too-new' };
      }
      throw error;
    }

    step = 'owner';
    const deps: DataDeps = { newId: createUuidV7(env.randomBytes), now: env.now };
    const ownerId = await db.write(['owners', 'change_log'], (c) => ensureOwner(c, deps));

    const open = connection;
    return {
      state: 'ready',
      encrypted,
      userVersion,
      data: {
        owner: createOwnerRepository(db, deps),
        pets: createPetRepository(db, deps, ownerId),
        medical: createMedicalRepository(db, deps, ownerId),
        subscribe: db.subscribe,
        // Queued, so work already started finishes before the connection closes.
        close: () => db.read(() => open.close()),
      },
    };
  } catch (error) {
    await closeQuietly(connection);
    logFailure(step, error);
    return failed(env);
  }
}

/**
 * Sets the current database aside and opens a new one. The old files and key are renamed and
 * copied side by side under one stamp, so the retired database stays readable. Nothing is deleted.
 */
async function startFresh(env: OpenEnv): Promise<OpenResult> {
  const moved: { from: string; to: string }[] = [];
  try {
    const at = stamp(env.now());
    const retiredKey = `${KEY_NAME}-${at}`;
    const moves = DB_SUFFIXES.map((suffix) => ({
      from: `${DB_NAME}${suffix}`,
      to: `pawcare-${at}.retired.db${suffix}`,
    }));
    // Never overwrite: refuse before moving anything if a retired name is already taken.
    for (const { to } of moves) {
      if (await env.files.exists(to)) throw new Error('Retired name taken');
    }
    if ((await env.keys.get(retiredKey)) !== null) throw new Error('Retired name taken');

    // Copy the key first: if the app dies after the renames, the retired files still have it.
    // On a later failure the copy stays (nothing is deleted) and the files go back beside the
    // unchanged current key.
    const oldKey = await env.keys.get(KEY_NAME);
    if (oldKey !== null) await env.keys.set(retiredKey, oldKey);
    for (const move of moves) {
      if (await env.files.exists(move.from)) {
        await env.files.rename(move.from, move.to);
        moved.push(move);
      }
    }
    // Only after the old key is safely copied and the files are out of the way.
    await env.keys.set(KEY_NAME, newKey(env));
  } catch (error) {
    // Put the files back together, so a database is never split from its -journal/-wal/-shm or
    // its key.
    for (const { from, to } of moved.reverse()) {
      await env.files.rename(to, from).catch(() => undefined);
    }
    logFailure('start-fresh', error);
    return failed(env);
  }
  return openPawCareData(env);
}
