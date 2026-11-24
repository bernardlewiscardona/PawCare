import type { SqlConnection } from './sql';

export type TableName =
  | 'owners'
  | 'pets'
  | 'pet_selection'
  | 'care_records'
  | 'medical_events'
  | 'vaccinations'
  | 'vaccine_due_items'
  | 'change_log';

export interface Database {
  /** Runs `fn` on the connection. Calls run one at a time, in call order. */
  read<T>(fn: (c: SqlConnection) => Promise<T>): Promise<T>;
  /**
   * Runs `fn` in a transaction (BEGIN IMMEDIATE, then COMMIT; ROLLBACK and rethrow on error).
   * Listeners hear about `tables` only after the commit; a listener that throws is logged and
   * doesn't reject the write.
   *
   * Never call `read` or `write` from inside `fn`: the queue is single-file, so it would deadlock.
   */
  write<T>(tables: readonly TableName[], fn: (c: SqlConnection) => Promise<T>): Promise<T>;
  subscribe(listener: (tables: ReadonlySet<TableName>) => void): () => void;
}

export function createDatabase(connection: SqlConnection): Database {
  const listeners = new Set<(tables: ReadonlySet<TableName>) => void>();
  let tail: Promise<unknown> = Promise.resolve();

  // A failed call must not block the ones behind it, so the tail swallows rejections.
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = tail.then(job);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    read: (fn) => enqueue(() => fn(connection)),
    write: (tables, fn) =>
      enqueue(async () => {
        await connection.exec('BEGIN IMMEDIATE');
        let value: Awaited<ReturnType<typeof fn>>;
        try {
          value = await fn(connection);
          await connection.exec('COMMIT');
        } catch (error) {
          await connection.exec('ROLLBACK').catch(() => undefined);
          throw error;
        }
        // The write has committed: a listener's failure must not reject it or skip the others.
        const changed: ReadonlySet<TableName> = new Set(tables);
        for (const listener of [...listeners]) {
          try {
            listener(changed);
          } catch (error) {
            // Only the class name: never a message or value.
            console.warn(
              '[data] listener failed:',
              error instanceof Error ? error.name : 'unknown',
            );
          }
        }
        return value;
      }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
