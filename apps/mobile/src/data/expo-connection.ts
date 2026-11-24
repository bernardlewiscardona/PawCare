import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqlConnection } from './sql';

/** `SqlConnection` over an expo-sqlite database. Kept thin: no logic beyond the shape change. */
export function expoConnection(db: SQLiteDatabase): SqlConnection {
  return {
    exec: (sql) => db.execAsync(sql),
    async run(sql, params = []) {
      const { changes } = await db.runAsync(sql, params);
      return { changes };
    },
    async get<T>(sql: string, params: Parameters<SqlConnection['get']>[1] = []) {
      // expo-sqlite answers "no row" with null; the contract uses undefined.
      return (await db.getFirstAsync<T>(sql, params)) ?? undefined;
    },
    all: (sql, params = []) => db.getAllAsync(sql, params),
    close: () => db.closeAsync(),
  };
}
