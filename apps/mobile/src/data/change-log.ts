import type { SqlConnection } from './sql';
import type { DataDeps } from './deps';

export interface ChangeEntry {
  ownerId: string;
  entityType: 'owner' | 'pet';
  entityId: string;
  entityVersion: number;
  action: string;
  /** Field names only, never values. */
  fields: readonly string[];
}

export async function recordChange(
  c: SqlConnection,
  deps: DataDeps,
  entry: ChangeEntry,
): Promise<void> {
  await c.run(
    `INSERT INTO change_log (id, owner_id, entity_type, entity_id, entity_version, action, fields, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deps.newId(),
      entry.ownerId,
      entry.entityType,
      entry.entityId,
      entry.entityVersion,
      entry.action,
      JSON.stringify(entry.fields),
      deps.now().toISOString(),
    ],
  );
}
