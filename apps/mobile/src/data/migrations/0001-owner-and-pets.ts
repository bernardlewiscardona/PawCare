import type { Migration } from './index';

// Mirrors the PostgreSQL baseline (apps/api/prisma/migrations/20261123132746_erd_schema,
// `pets_*_check`) with char_length/btrim -> length/trim. SQLite's length() counts code points.
export const migration0001: Migration = {
  version: 1,
  name: 'owner-and-pets',
  sql: `
CREATE TABLE owners (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  display_name TEXT
    CHECK (display_name IS NULL OR (length(trim(display_name)) >= 1 AND length(display_name) <= 100)),
  phone TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 1 AND 30),
  time_zone TEXT NOT NULL DEFAULT 'UTC' CHECK (length(time_zone) BETWEEN 1 AND 64),
  weight_unit TEXT NOT NULL DEFAULT 'KG' CHECK (weight_unit IN ('KG','LB')),
  profile_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CHECK (profile_completed_at IS NULL OR display_name IS NOT NULL)
);
CREATE UNIQUE INDEX owners_single ON owners ((1));

CREATE TABLE pets (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL REFERENCES owners (id),
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1 AND length(name) <= 100),
  species TEXT NOT NULL CHECK (species IN ('DOG','CAT','BIRD','RABBIT','OTHER')),
  species_other TEXT,
  breed TEXT CHECK (breed IS NULL OR (length(trim(breed)) >= 1 AND length(breed) <= 100)),
  sex TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (sex IN ('MALE','FEMALE','UNKNOWN')),
  birth_date TEXT CHECK (birth_date IS NULL OR date(birth_date) = birth_date),
  birth_date_estimated INTEGER NOT NULL DEFAULT 0 CHECK (birth_date_estimated IN (0,1)),
  current_weight_g INTEGER CHECK (current_weight_g IS NULL OR (current_weight_g > 0 AND current_weight_g <= 1000000)),
  weight_measured_on TEXT CHECK (weight_measured_on IS NULL OR date(weight_measured_on) = weight_measured_on),
  microchip TEXT CHECK (microchip IS NULL OR length(microchip) BETWEEN 1 AND 50),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (owner_id, id),
  CHECK (
    (species = 'OTHER' AND species_other IS NOT NULL
      AND length(trim(species_other)) >= 1 AND length(species_other) <= 100)
    OR (species <> 'OTHER' AND species_other IS NULL)),
  CHECK (weight_measured_on IS NULL OR current_weight_g IS NOT NULL),
  CHECK (birth_date_estimated = 0 OR birth_date IS NOT NULL)
);
CREATE INDEX pets_owner_archived ON pets (owner_id, archived_at);

CREATE TABLE change_log (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL REFERENCES owners (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('owner','pet')),
  entity_id TEXT NOT NULL,
  entity_version INTEGER NOT NULL,
  action TEXT NOT NULL,
  fields TEXT NOT NULL CHECK (json_valid(fields)),
  occurred_at TEXT NOT NULL
);
CREATE TRIGGER change_log_no_update BEFORE UPDATE ON change_log
BEGIN SELECT RAISE(ABORT, 'change_log is append-only'); END;
CREATE TRIGGER change_log_no_delete BEFORE DELETE ON change_log
BEGIN SELECT RAISE(ABORT, 'change_log is append-only'); END;
`,
};
