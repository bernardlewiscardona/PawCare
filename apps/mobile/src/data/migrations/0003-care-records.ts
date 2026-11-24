import type { Migration } from './index';

// MR-01: the shared CARE_RECORDS parent and the MEDICAL_EVENTS subtype, mirroring the
// PostgreSQL baseline (apps/api/prisma/migrations/20261123132746_erd_schema) with the SQLite
// conversions in CLAUDE.md. `appointment_id` joins medical_events with AP-05.
//
// SQLite has no deferred triggers, so PostgreSQL's care_records_require_subtype check (every
// parent has its subtype row by commit) is enforced by the repositories, which write both in one
// transaction. AUTH-01's upload must re-check it.
//
// change_log is rebuilt to accept 'care_record': SQLite can't alter a CHECK. DROP TABLE's
// implicit delete fires no triggers, so the append-only triggers don't block it; they are
// recreated on the new table.
export const migration0003: Migration = {
  version: 3,
  name: 'care-records',
  sql: `
CREATE TABLE care_records (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('MEDICAL','VACCINE','PRESCRIPTION','APPOINTMENT')),
  occurrence_date TEXT NOT NULL CHECK (date(occurrence_date) = occurrence_date),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VOIDED')),
  provenance TEXT NOT NULL DEFAULT 'OWNER_ENTERED' CHECK (provenance = 'OWNER_ENTERED'),
  void_reason TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (owner_id, id, kind),
  UNIQUE (owner_id, pet_id, id, kind),
  FOREIGN KEY (owner_id, pet_id) REFERENCES pets (owner_id, id),
  CHECK ((status = 'ACTIVE' AND void_reason IS NULL AND voided_at IS NULL)
    OR (status = 'VOIDED' AND voided_at IS NOT NULL AND void_reason IS NOT NULL
      AND length(trim(void_reason)) >= 1 AND length(void_reason) <= 500)),
  CHECK (kind <> 'APPOINTMENT' OR status = 'ACTIVE')
);
CREATE INDEX care_records_owner_pet_date ON care_records (owner_id, pet_id, occurrence_date, id);

CREATE TABLE medical_events (
  record_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'MEDICAL' CHECK (kind = 'MEDICAL'),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('VISIT','DIAGNOSIS','PROCEDURE','ALLERGY','GENERAL_NOTE')),
  title TEXT NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 150),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 5000),
  provider_name TEXT CHECK (provider_name IS NULL
    OR (length(trim(provider_name)) >= 1 AND length(provider_name) <= 150)),
  FOREIGN KEY (owner_id, pet_id, record_id, kind)
    REFERENCES care_records (owner_id, pet_id, id, kind)
);

CREATE TABLE change_log_v2 (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL REFERENCES owners (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('owner','pet','care_record')),
  entity_id TEXT NOT NULL,
  entity_version INTEGER NOT NULL,
  action TEXT NOT NULL,
  fields TEXT NOT NULL CHECK (json_valid(fields)),
  occurred_at TEXT NOT NULL
);
INSERT INTO change_log_v2 (id, owner_id, entity_type, entity_id, entity_version, action, fields, occurred_at)
  SELECT id, owner_id, entity_type, entity_id, entity_version, action, fields, occurred_at
  FROM change_log;
DROP TABLE change_log;
ALTER TABLE change_log_v2 RENAME TO change_log;
CREATE TRIGGER change_log_no_update BEFORE UPDATE ON change_log
BEGIN SELECT RAISE(ABORT, 'change_log is append-only'); END;
CREATE TRIGGER change_log_no_delete BEFORE DELETE ON change_log
BEGIN SELECT RAISE(ABORT, 'change_log is append-only'); END;
`,
};
