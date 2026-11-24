// Tests only: app code never imports this file.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlConnection, SqlValue } from '../sql';

export function openNodeConnection(): SqlConnection {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const bind = (params: SqlValue[] = []) => params as SQLInputValue[];
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params) {
      const result = db.prepare(sql).run(...bind(params));
      return { changes: Number(result.changes) };
    },
    async get<T>(sql: string, params?: SqlValue[]) {
      return db.prepare(sql).get(...bind(params)) as T | undefined;
    },
    async all<T>(sql: string, params?: SqlValue[]) {
      return db.prepare(sql).all(...bind(params)) as T[];
    },
    async close() {
      db.close();
    },
  };
}
