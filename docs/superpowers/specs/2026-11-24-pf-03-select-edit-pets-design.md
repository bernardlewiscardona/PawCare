# PF-03 — Select and edit pet profiles (phone data layer)

Date: 24 Nov 2026 · Status: approved 24 Nov 2026 · Ticket: PF-03 · Branch: `PF-03-edit-pet-profiles`
· Spec: `docs/spec/epics/PF.md` (PF-03), `docs/spec/00-overview.md` (shared requirements)

## Intent

Owners with several pets need every care action attached to the right animal. PF-03 adds the two
things the rest of the app hangs off: **which pet is selected**, and **editing a pet's profile**
without losing its history. We deliver the on-phone data layer and its contract; the screens
(pet switcher, discard prompt on switch, edit form, empty state with Add Pet) are `PF-03-APP`.

## Goals

- `pets.update` edits every PF-02 field, with version-based conflict detection.
- The selected pet is stored on the phone and survives a restart. When it is archived or missing,
  the data layer falls back to another active pet, or to none.
- Every pet query is scoped by `owner_id` (fixes the gap left on `main` by LOCAL-01).
- `Pet` exposes `archivedAt`.

## Non-goals

- Archive and restore (PF-04). PF-03 only reads `archived_at`.
- Pet photos (deferred to MR-02, decision 23 Nov 2026): the screens show a placeholder.
- Screens, the discard prompt and the empty state (PF-03-APP).
- Weight history: editing the weight replaces `current_weight_g` and `weight_measured_on`, as in
  the ERD.

## Anti-goals

- A selection that silently points a care record at the wrong pet (AC2): the data layer never
  changes the selection on its own except through the documented fallback, and later care
  repositories take a `petId`, never "whatever is selected".
- Edits that overwrite newer data without a conflict.

## Approaches (for where the selected pet lives)

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| **A. Data layer:** a small table on the phone plus `pets.selected()` / `pets.select(id)` | One migration and a table not in the ERD; the archived-pet fallback is written and tested once | **Chosen by the user, 24 Nov 2026** |
| B. App state: the app developer stores the ID in their own storage | No migration; every screen handles the archived fallback itself, untested by us | Rejected |

## Design

### Migration `0002-pet-selection`

```sql
CREATE TABLE pet_selection (
  owner_id TEXT PRIMARY KEY REFERENCES owners (id),
  pet_id TEXT NOT NULL,
  selected_at TEXT NOT NULL,
  FOREIGN KEY (owner_id, pet_id) REFERENCES pets (owner_id, id)
);
```

One row per owner, same-owner composite FK. It is a device preference: **not versioned, not
written to `change_log`, and not uploaded** with AUTH-01 (my call: it is not a material mutation
under shared requirement 6). `TableName` gains `'pet_selection'` so `useLiveQuery` refreshes.

### Contract (`src/data/index.ts`)

- `Pet` gains `archivedAt: string | null`.
- `pets.update(input: UpdatePetInput): Promise<Pet>` where `UpdatePetInput` is
  `{ id, version, name?, species?, speciesOther?, breed?, sex?, birthDate?, birthDateEstimated?,
  weight?: { value, unit }, weightMeasuredOn?, microchip? }`. `null` clears an optional field;
  `name` and `species` can't be null.
- `pets.selected(): Promise<Pet | null>` — the selected pet if it is active; otherwise the
  oldest active pet (lowest ID); `null` when there are no active pets. Reading never writes.
- `pets.select(id): Promise<Pet>` — stores the selection; an unknown, other-owner or archived
  pet is `NOT_FOUND`.
- `pets.create` also selects the new pet, in the same transaction (my call, matching the demo
  store, so a newly registered pet is the one on screen).

### Update rules

- Runs in `db.write(['pets', 'change_log'])`. Reads the pet by `owner_id` + `id`; missing or
  archived → `NOT_FOUND` (archived history is read-only per PF-04; PF-04 may add its own code).
- Shape check (`parseUpdatePetInput`) then the PF-02 field rules from `@pawcare/core`, reusing
  `normalizePet`'s per-field checks. Every error comes back in one `VALIDATION_FAILED`.
- Pair rules are checked on the **merged** result (current row + changes):
  - species changed away from Other → description cleared; changed to Other with no description
    → error on `speciesOther`; a description on a non-Other species → error.
  - birth date cleared → `birthDateEstimated` becomes false; estimated with no birth date → error.
  - weight cleared → measurement date cleared; a new weight with no date → today in the owner's
    zone; a date with no weight (current or new) → error.
  - Future-date checks use the owner's local date, as in PF-02.
- No changed fields: same version → return the pet unchanged, no log row; stale version →
  `CONFLICT`.
- `UPDATE pets SET … , version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND
  version = ? AND archived_at IS NULL`; 0 rows → `CONFLICT` with the current pet in `details`.
- One `change_log` row: `pet.updated`, the new version, changed **field names only**.

### Owner scoping

`list`, `get`, the read-back after create, `update`, `selected` and `select` all filter by the
owner's ID. Tests drop the `owners_single` index in their own test database, insert a second owner
and their pet directly in SQL, and prove that pet is invisible to every call.

### Backlog

- PF-03 → In Progress; add `PF-03-APP` (Pet switcher and edit screens on the phone data layer,
  depends on PF-03).
- LOCAL-01 → Done (merged); PF-01, PF-02 → Done for the data layer (their `-APP` rows stay open);
  FN-01 → In Review.

## Tests (written first)

Each row of the PF-03 test plan: owner isolation for every call; `archivedAt` on `get`; update
of every field and clearing every optional field; PF-02 rules on edit; the pair rules above;
stale version; no-op; archived pet refused; same-name rename allowed; empty list; generic
not-found; owner-zone "today" near midnight; rollback when the change-log write fails; selection
persists, falls back to the oldest active pet when the selected one is archived, returns `null`
with no active pets, and `select` refuses archived or unknown pets; create selects the new pet;
migration 0002 constraints (composite FK rejects another owner's pet).

## Left to the builder

Helper names and file split inside `src/data/pets`; how `normalizePet` is shared between create
and update; error message wording (following PF-02's tone).
