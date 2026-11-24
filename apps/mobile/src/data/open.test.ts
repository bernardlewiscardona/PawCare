import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, KEY_NAME, openPawCareData, type OpenEnv, type OpenResult } from './open';
import type { SqlConnection } from './sql';
import { openNodeConnection } from './testing/node-sqlite';

const NOW = new Date('2026-11-24T08:09:10.123Z');
const STAMP = '20261124T080910123Z';
const K1 = '11'.repeat(32);

interface FakeConnection {
  raw: SqlConnection;
  statements: string[];
  close: ReturnType<typeof vi.fn>;
}

interface FakeOptions {
  isExpoGo?: boolean;
  isDev?: boolean;
  keys?: Record<string, string>;
  files?: string[];
  cipherVersion?: string | null;
  prepare?: (raw: SqlConnection) => Promise<void>;
}

function fakeEnv(options: FakeOptions = {}) {
  const keys = new Map(Object.entries(options.keys ?? {}));
  const files = new Set(options.files ?? []);
  const connections: FakeConnection[] = [];
  let seed = 0;

  // Wraps a real in-memory SQLite: answers the SQLCipher pragmas, passes everything else through.
  async function connectFake(name: string): Promise<SqlConnection> {
    const raw = openNodeConnection();
    await options.prepare?.(raw);
    files.add(name);
    const statements: string[] = [];
    // The raw database stays readable after close, so tests can inspect it.
    const close = vi.fn(async () => undefined);
    connections.push({ raw, statements, close });
    return {
      async exec(sql) {
        statements.push(sql);
        if (sql.startsWith('PRAGMA key')) return;
        await raw.exec(sql);
      },
      run(sql, params) {
        statements.push(sql);
        return raw.run(sql, params);
      },
      async get<T>(sql: string, params?: Parameters<SqlConnection['get']>[1]) {
        statements.push(sql);
        if (sql === 'PRAGMA cipher_version') {
          const version = options.cipherVersion === undefined ? '4.6.1' : options.cipherVersion;
          return (version === null ? undefined : { cipher_version: version }) as T | undefined;
        }
        return raw.get<T>(sql, params);
      },
      all(sql, params) {
        statements.push(sql);
        return raw.all(sql, params);
      },
      close,
    };
  }

  const env = {
    isExpoGo: options.isExpoGo ?? false,
    isDev: options.isDev ?? false,
    keys: {
      get: vi.fn(async (name: string) => keys.get(name) ?? null),
      set: vi.fn(async (name: string, value: string) => {
        keys.set(name, value);
      }),
    },
    files: {
      exists: vi.fn(async (name: string) => files.has(name)),
      rename: vi.fn(async (from: string, to: string) => {
        if (!files.has(from) || files.has(to)) throw new Error('bad rename');
        files.delete(from);
        files.add(to);
      }),
    },
    connect: vi.fn(connectFake),
    randomBytes: vi.fn((n: number) => {
      seed += 1;
      return new Uint8Array(n).fill(seed);
    }),
    now: vi.fn(() => NOW),
  } satisfies OpenEnv;

  return { env, keys, files, connections };
}

function expectState<S extends OpenResult['state']>(
  result: OpenResult,
  state: S,
): Extract<OpenResult, { state: S }> {
  expect(result.state).toBe(state);
  return result as Extract<OpenResult, { state: S }>;
}

let warn: ReturnType<typeof vi.spyOn>;
afterEach(() => {
  warn?.mockRestore();
});

describe('openPawCareData', () => {
  it('opens a fresh install encrypted, with a new key applied before anything else', async () => {
    const { env, keys, connections } = fakeEnv();
    const ready = expectState(await openPawCareData(env), 'ready');

    expect(ready.encrypted).toBe(true);
    expect(ready.userVersion).toBe(1);
    const key = keys.get(KEY_NAME);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(env.randomBytes).toHaveBeenCalledWith(32);
    expect(env.connect).toHaveBeenCalledWith(DB_NAME);
    expect(connections[0]!.statements[0]).toBe(`PRAGMA key = "x'${key}'"`);
    expect(connections[0]!.statements[1]).toBe('PRAGMA cipher_version');
    expect(await ready.data.owner.get()).toMatchObject({ profileSetupRequired: true });

    await ready.data.close();
    expect(connections[0]!.close).toHaveBeenCalled();
  });

  it('reuses the stored key on the next open', async () => {
    const { env, keys, connections } = fakeEnv({ keys: { [KEY_NAME]: K1 }, files: [DB_NAME] });
    expectState(await openPawCareData(env), 'ready');
    expect(keys.get(KEY_NAME)).toBe(K1);
    expect(env.keys.set).not.toHaveBeenCalled();
    expect(connections[0]!.statements[0]).toBe(`PRAGMA key = "x'${K1}'"`);
  });

  it('opens unencrypted only in Expo Go with __DEV__', async () => {
    const { env, keys, connections } = fakeEnv({ isExpoGo: true, isDev: true });
    const ready = expectState(await openPawCareData(env), 'ready');
    expect(ready.encrypted).toBe(false);
    expect(keys.size).toBe(0);
    expect(connections[0]!.statements.some((s) => s.startsWith('PRAGMA key'))).toBe(false);
    expect(await ready.data.owner.get()).toMatchObject({ profileSetupRequired: true });
  });

  it('treats Expo Go without __DEV__ as encrypted', async () => {
    const { env, keys, connections } = fakeEnv({ isExpoGo: true, isDev: false });
    const ready = expectState(await openPawCareData(env), 'ready');
    expect(ready.encrypted).toBe(true);
    expect(keys.get(KEY_NAME)).toMatch(/^[0-9a-f]{64}$/);
    expect(connections[0]!.statements[0]).toMatch(/^PRAGMA key/);
  });

  it('refuses to open when SQLCipher is missing, running nothing else', async () => {
    const { env, connections } = fakeEnv({ cipherVersion: null });
    expectState(await openPawCareData(env), 'encryption-unavailable');
    const [conn] = connections;
    expect(conn!.statements).toEqual([
      expect.stringMatching(/^PRAGMA key/),
      'PRAGMA cipher_version',
    ]);
    expect(conn!.close).toHaveBeenCalled();
    const tables = await conn!.raw.all("SELECT name FROM sqlite_master WHERE type = 'table'");
    expect(tables).toEqual([]);
  });

  it('reports key-missing when the file exists without a key, without connecting', async () => {
    const { env, keys } = fakeEnv({ files: [DB_NAME] });
    expectState(await openPawCareData(env), 'key-missing');
    expect(env.connect).not.toHaveBeenCalled();
    expect(keys.size).toBe(0);
  });

  it('reports too-new for a database from a newer app, and closes it', async () => {
    const { env, connections } = fakeEnv({
      prepare: (raw) => raw.exec('PRAGMA user_version = 99'),
    });
    const result = await openPawCareData(env);
    expect(result).toEqual({ state: 'too-new' });
    expect(connections[0]!.close).toHaveBeenCalled();
  });

  it('fails when connect rejects, logging only the step and error name; retry recovers', async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { env, keys } = fakeEnv();
    const error = new Error(`cannot open /data/user/0/com.pawcare.app/files/SQLite/${DB_NAME}`);
    error.name = 'SQLiteOpenError';
    env.connect.mockRejectedValueOnce(error);

    const failed = expectState(await openPawCareData(env), 'failed');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[data] open failed at connect:', 'SQLiteOpenError');
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(keys.get(KEY_NAME)!);
    expect(logged).not.toContain(DB_NAME);
    expect(logged).not.toContain('/data/');

    const ready = expectState(await failed.retry(), 'ready');
    expect(ready.encrypted).toBe(true);
  });

  it('fails without sending a malformed stored key to SQLite', async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { env, connections } = fakeEnv({ keys: { [KEY_NAME]: `abc"; DROP TABLE owners; --` } });
    expectState(await openPawCareData(env), 'failed');
    expect(warn).toHaveBeenCalledWith('[data] open failed at key:', 'Error');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('DROP');
    for (const conn of connections) {
      expect(conn.statements.some((s) => s.includes('DROP'))).toBe(false);
      expect(conn.close).toHaveBeenCalled();
    }
  });

  it('closes the connection and fails when a migration fails', async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { env, connections } = fakeEnv({
      // A table the first migration also creates, so the migration fails.
      prepare: (raw) => raw.exec('CREATE TABLE owners (x TEXT)'),
    });
    expectState(await openPawCareData(env), 'failed');
    expect(warn).toHaveBeenCalledWith('[data] open failed at migrate:', expect.any(String));
    expect(connections[0]!.close).toHaveBeenCalled();
  });

  it('starts fresh from failed: retires the files and key side by side, deletes nothing', async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const live = [DB_NAME, `${DB_NAME}-wal`, `${DB_NAME}-shm`];
    const { env, keys, files } = fakeEnv({ keys: { [KEY_NAME]: K1 }, files: live });
    env.connect.mockRejectedValueOnce(new Error('corrupt'));

    const failed = expectState(await openPawCareData(env), 'failed');
    const ready = expectState(await failed.startFresh(), 'ready');

    expect(ready.encrypted).toBe(true);
    expect([...files].sort()).toEqual(
      [
        DB_NAME, // the new database
        `pawcare-${STAMP}.retired.db`,
        `pawcare-${STAMP}.retired.db-wal`,
        `pawcare-${STAMP}.retired.db-shm`,
      ].sort(),
    );
    expect(keys.get(`pawcare-db-key-${STAMP}`)).toBe(K1);
    const fresh = keys.get(KEY_NAME);
    expect(fresh).toMatch(/^[0-9a-f]{64}$/);
    expect(fresh).not.toBe(K1);
    expect(keys.size).toBe(2);
    expect(env.keys.set).toHaveBeenCalledTimes(2);
    expect(env.files.rename).toHaveBeenCalledTimes(3);
  });

  it('refuses to start fresh over an existing retired name, moving nothing', async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const taken = `pawcare-${STAMP}.retired.db-wal`;
    const { env, keys, files } = fakeEnv({ files: [DB_NAME, taken] });
    const missing = expectState(await openPawCareData(env), 'key-missing');
    expectState(await missing.startFresh(), 'failed');
    expect(warn).toHaveBeenCalledWith('[data] open failed at start-fresh:', 'Error');
    expect(env.files.rename).not.toHaveBeenCalled();
    expect([...files].sort()).toEqual([DB_NAME, taken].sort());
    expect(keys.size).toBe(0);
  });

  it('starts fresh from key-missing: renames the old file and opens a new one', async () => {
    const { env, keys, files } = fakeEnv({ files: [DB_NAME] });
    const missing = expectState(await openPawCareData(env), 'key-missing');
    const ready = expectState(await missing.startFresh(), 'ready');

    expect(ready.encrypted).toBe(true);
    expect(files.has(`pawcare-${STAMP}.retired.db`)).toBe(true);
    expect(files.has(DB_NAME)).toBe(true);
    expect(env.files.rename).toHaveBeenCalledTimes(1);
    expect(env.files.rename).toHaveBeenCalledWith(DB_NAME, `pawcare-${STAMP}.retired.db`);
    // No old key to keep: only the new one exists.
    expect([...keys.keys()]).toEqual([KEY_NAME]);
    expect(await ready.data.owner.get()).toMatchObject({ profileSetupRequired: true });
  });
});
