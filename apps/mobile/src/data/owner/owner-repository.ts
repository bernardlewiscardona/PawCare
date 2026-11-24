import {
  type FieldErrors,
  type RuleError,
  checkTimeZone,
  isRuleError,
  normalizeDisplayName,
  normalizePhone,
} from '@pawcare/core';
import { recordChange } from '../change-log';
import type { Database } from '../database';
import type { DataDeps } from '../deps';
import { conflict, notFound, validationFailed } from '../errors';
import type { SqlConnection } from '../sql';
import type { OwnerProfile, UpdateOwnerInput } from '../types';
import { parseUpdateOwnerInput } from './owner-input';

const PROFILE_FIELDS = ['displayName', 'phone', 'timeZone', 'weightUnit'] as const;
type ProfileField = (typeof PROFILE_FIELDS)[number];
type ProfileChanges = Partial<Record<ProfileField, string | null>>;

const COLUMNS: Record<ProfileField, string> = {
  displayName: 'display_name',
  phone: 'phone',
  timeZone: 'time_zone',
  weightUnit: 'weight_unit',
};

const SETUP_FIELD_MESSAGE = 'Required to finish setting up your profile.';
const CONFLICT_MESSAGE =
  'This profile was changed elsewhere. Review the latest version and try again.';

interface OwnerRow {
  id: string;
  display_name: string | null;
  phone: string | null;
  time_zone: string;
  weight_unit: 'KG' | 'LB';
  profile_completed_at: string | null;
  version: number;
}

export interface OwnerRepository {
  get(): Promise<OwnerProfile>;
  update(input: UpdateOwnerInput): Promise<OwnerProfile>;
}

function toProfile(row: OwnerRow): OwnerProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    phone: row.phone,
    timeZone: row.time_zone,
    weightUnit: row.weight_unit,
    profileSetupRequired: row.profile_completed_at === null,
    version: row.version,
  };
}

async function readRow(c: SqlConnection): Promise<OwnerRow | undefined> {
  return c.get<OwnerRow>('SELECT * FROM owners LIMIT 1');
}

/** Returns the owner's ID, creating the placeholder owner on first use. */
export async function ensureOwner(c: SqlConnection, deps: DataDeps): Promise<string> {
  const existing = await readRow(c);
  if (existing) return existing.id;
  const id = deps.newId();
  const at = deps.now().toISOString();
  await c.run(
    `INSERT INTO owners (id, display_name, time_zone, weight_unit, created_at, updated_at)
     VALUES (?, NULL, 'UTC', 'KG', ?, ?)`,
    [id, at, at],
  );
  await recordChange(c, deps, {
    ownerId: id,
    entityType: 'owner',
    entityId: id,
    entityVersion: 1,
    action: 'owner.created',
    fields: [],
  });
  return id;
}

/** Applies the field rules to every field present; throws one error listing all failures. */
function normalizeChanges(input: UpdateOwnerInput): ProfileChanges {
  const changes: ProfileChanges = {};
  const errors: FieldErrors = {};
  const apply = (field: ProfileField, result: string | null | RuleError) => {
    if (isRuleError(result)) errors[field] = [result.error];
    else changes[field] = result;
  };
  if (input.displayName !== undefined)
    apply('displayName', normalizeDisplayName(input.displayName));
  if (input.phone !== undefined) apply('phone', normalizePhone(input.phone));
  if (input.timeZone !== undefined) apply('timeZone', checkTimeZone(input.timeZone));
  if (input.weightUnit !== undefined) apply('weightUnit', input.weightUnit);
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return changes;
}

export function createOwnerRepository(db: Database, deps: DataDeps): OwnerRepository {
  return {
    async get() {
      const row = await db.read((c) => readRow(c));
      if (!row) throw notFound();
      return toProfile(row);
    },

    async update(rawInput) {
      const input = parseUpdateOwnerInput(rawInput);
      const changes = normalizeChanges(input);

      return db.write(['owners', 'change_log'], async (c) => {
        const current = await readRow(c);
        if (!current) throw notFound();
        const setupRequired = current.profile_completed_at === null;

        if (setupRequired) {
          const missing: FieldErrors = {};
          if (changes.displayName === undefined) missing.displayName = [SETUP_FIELD_MESSAGE];
          if (changes.timeZone === undefined) missing.timeZone = [SETUP_FIELD_MESSAGE];
          if (Object.keys(missing).length > 0) throw validationFailed(missing);
        }

        const currentValues: Record<ProfileField, string | null> = {
          displayName: current.display_name,
          phone: current.phone,
          timeZone: current.time_zone,
          weightUnit: current.weight_unit,
        };
        const changedFields = PROFILE_FIELDS.filter(
          (f) => changes[f] !== undefined && changes[f] !== currentValues[f],
        );
        if (changedFields.length === 0 && !setupRequired) {
          if (current.version === input.version) return toProfile(current);
          throw conflict(CONFLICT_MESSAGE, toProfile(current));
        }

        const at = deps.now().toISOString();
        const sets = changedFields.map((f) => `${COLUMNS[f]} = ?`);
        const params = changedFields.map((f) => changes[f] as string | null);
        if (setupRequired) {
          sets.push('profile_completed_at = ?');
          params.push(at);
        }
        const { changes: count } = await c.run(
          `UPDATE owners SET ${sets.join(', ')}, version = version + 1, updated_at = ?
           WHERE id = ? AND version = ?`,
          [...params, at, current.id, input.version],
        );
        const updated = (await readRow(c))!;
        if (count === 0) throw conflict(CONFLICT_MESSAGE, toProfile(updated));

        await recordChange(c, deps, {
          ownerId: current.id,
          entityType: 'owner',
          entityId: current.id,
          entityVersion: updated.version,
          action: 'owner.profile_updated',
          fields: changedFields,
        });
        return toProfile(updated);
      });
    },
  };
}
