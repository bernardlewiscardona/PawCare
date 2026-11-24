import type { Migration } from './index';

// PF-03: the selected pet. A device preference, one row per owner: not versioned, not written to
// change_log, and not uploaded with AUTH-01. The composite key keeps it to the owner's own pets.
export const migration0002: Migration = {
  version: 2,
  name: 'pet-selection',
  sql: `
CREATE TABLE pet_selection (
  owner_id TEXT PRIMARY KEY REFERENCES owners (id),
  pet_id TEXT NOT NULL CHECK (length(pet_id) = 36),
  selected_at TEXT NOT NULL,
  FOREIGN KEY (owner_id, pet_id) REFERENCES pets (owner_id, id)
);
`,
};
