import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from './database';
import { openNodeConnection } from './testing/node-sqlite';

async function setup() {
  const conn = openNodeConnection();
  await conn.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
  return { conn, db: createDatabase(conn) };
}

describe('createDatabase', () => {
  it('runs two writes started together one after the other', async () => {
    const { db } = await setup();
    const first = db.write(['pets'], async (c) => {
      await Promise.resolve();
      await c.run("INSERT INTO t (id, v) VALUES (1, 'a')");
    });
    const second = db.write(['pets'], async (c) =>
      c.get<{ v: string }>('SELECT v FROM t WHERE id = 1'),
    );
    await first;
    expect(await second).toEqual({ v: 'a' });
  });

  it('rolls back, rethrows and lets the next write succeed', async () => {
    const { db } = await setup();
    await expect(
      db.write(['pets'], async (c) => {
        await c.run("INSERT INTO t (id, v) VALUES (1, 'a')");
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.read((c) => c.all('SELECT * FROM t'))).toEqual([]);
    await db.write(['pets'], (c) => c.run("INSERT INTO t (id, v) VALUES (2, 'b')"));
    expect(await db.read((c) => c.all('SELECT * FROM t'))).toHaveLength(1);
  });

  it('notifies after a commit only, and not after unsubscribing', async () => {
    const { db } = await setup();
    const listener = vi.fn();
    const unsubscribe = db.subscribe(listener);
    await db.write(['pets'], (c) => c.run("INSERT INTO t (id, v) VALUES (1, 'a')"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0]).toEqual(new Set(['pets']));
    await expect(
      db.write(['pets'], async () => {
        throw new Error('x');
      }),
    ).rejects.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await db.write(['pets'], (c) => c.run("INSERT INTO t (id, v) VALUES (2, 'b')"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
