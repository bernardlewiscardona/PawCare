import type { Migration } from './index';

// VC-01: the VACCINATIONS subtype of care_records and the documented next due date, mirroring
// the PostgreSQL baseline (apps/api/prisma/migrations/20261123132746_erd_schema). The parent's
// occurrence_date equals administered_on. `fulfilled_by_vaccination_id` stays empty until VC-04
// closes a due item with a later dose (D-ERD-3: at most one item per fulfilling vaccination);
// it exists now because SQLite can't add a composite foreign key without rebuilding the table.
//
// Dates use `date(x) IS x`, not `= x`: date() returns NULL for e.g. '2026-13-01', and a CHECK
// that evaluates to NULL passes. (0001 and 0003 use `=`; the repositories validate first.)
export const migration0004: Migration = {
  version: 4,
  name: 'vaccinations',
  sql: `
CREATE TABLE vaccinations (
  record_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'VACCINE' CHECK (kind = 'VACCINE'),
  vaccine_name TEXT NOT NULL CHECK (length(trim(vaccine_name)) >= 1 AND length(vaccine_name) <= 150),
  administered_on TEXT NOT NULL CHECK (date(administered_on) IS administered_on),
  provider_name TEXT CHECK (provider_name IS NULL
    OR (length(trim(provider_name)) >= 1 AND length(provider_name) <= 150)),
  batch_label TEXT CHECK (batch_label IS NULL OR length(batch_label) BETWEEN 1 AND 100),
  UNIQUE (owner_id, pet_id, record_id),
  FOREIGN KEY (owner_id, pet_id, record_id, kind)
    REFERENCES care_records (owner_id, pet_id, id, kind)
);

CREATE TABLE vaccine_due_items (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  vaccination_id TEXT NOT NULL,
  due_on TEXT NOT NULL CHECK (date(due_on) IS due_on),
  fulfilled_by_vaccination_id TEXT,
  schedule_version INTEGER NOT NULL DEFAULT 1 CHECK (schedule_version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (owner_id, pet_id, vaccination_id),
  UNIQUE (owner_id, pet_id, fulfilled_by_vaccination_id),
  CHECK (fulfilled_by_vaccination_id IS NULL OR fulfilled_by_vaccination_id <> vaccination_id),
  FOREIGN KEY (owner_id, pet_id, vaccination_id)
    REFERENCES vaccinations (owner_id, pet_id, record_id),
  FOREIGN KEY (owner_id, pet_id, fulfilled_by_vaccination_id)
    REFERENCES vaccinations (owner_id, pet_id, record_id)
);
CREATE INDEX vaccine_due_items_owner_due ON vaccine_due_items (owner_id, due_on);
`,
};
