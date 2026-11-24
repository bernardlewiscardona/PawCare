import type { Database } from '../database';
import { migration0001 } from './0001-owner-and-pets';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [migration0001];
export const LATEST_VERSION: number = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export class MigrationTooNewError extends Error {
  constructor() {
    super('This data was written by a newer version of the app.');
    this.name = 'MigrationTooNewError';
  }
}

export async function migrate(db: Database): Promise<{ from: number; to: number }> {
  const row = await db.read((c) => c.get<{ user_version: number }>('PRAGMA user_version'));
  const from = row?.user_version ?? 0;
  if (from > LATEST_VERSION) throw new MigrationTooNewError();
  for (const m of MIGRATIONS) {
    if (m.version <= from) continue;
    await db.write([], async (c) => {
      await c.exec(m.sql);
      // PRAGMA takes no bound parameters; `version` is a trusted integer constant.
      await c.exec(`PRAGMA user_version = ${m.version}`);
    });
  }
  return { from, to: LATEST_VERSION };
}
