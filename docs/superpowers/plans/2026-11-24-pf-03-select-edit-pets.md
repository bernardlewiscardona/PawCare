# PF-03 Select and Edit Pets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-scoped pet reads, a stored selected pet with fallback, and versioned pet editing to the phone data layer.

**Architecture:** Everything lives in `apps/mobile/src/data`. The pet repository gains an explicit `ownerId` (from `ensureOwner`) used in every query, migration 0002 adds a one-row-per-owner `pet_selection` table, and `pets.update` follows the owner repository's version-check pattern, reusing the PF-02 rules from `@pawcare/core`.

**Tech Stack:** TypeScript, SQLite (`expo-sqlite` in the app, `node:sqlite` in tests), Vitest, `@pawcare/core`.

**Spec:** `docs/superpowers/specs/2026-11-24-pf-03-select-edit-pets-design.md` (and `docs/spec/epics/PF.md`, PF-03)

## Global Constraints

- Branch `PF-03-edit-pet-profiles`; commit messages `PF-03: <imperative summary>`; no Claude trailers.
- Work only in `apps/mobile/src/data`, `apps/mobile/AGENTS.md` and `docs/backlog.csv`. Do not touch `apps/api` or `packages/core` (no new rules are needed).
- Migrations are append-only: never edit `0001-owner-and-pets.ts`.
- SQL uses bound parameters only. Every pet query filters by `owner_id`.
- `change_log` rows hold field names only, never values; written in the same transaction.
- Errors are `DataError` from `errors.ts`: `validationFailed`, `notFound()` (message `Not found`, details `null`), `conflict(message, current)`.
- Run mobile tests with `pnpm --filter mobile exec vitest run <path>` from the repo root.
- Before finishing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e` (e2e needs `docker compose up -d db`).

## Review Focus

1. Another owner's pet ID passed to `update` or `select` must give the same generic `NOT_FOUND` as an unknown ID — never `CONFLICT` or a validation error that proves it exists. (Task 4, Task 5)
2. The selected pet gets archived: `selected()` must fall back to the oldest active pet, and to `null` when none is left, without writing. (Task 3)
3. A stale `version` with no real changes still returns `CONFLICT`, not a silent success. (Task 5)
4. A weight edited in LB is stored in grams exactly as `create` stores it (22 lb → `currentWeightKg` 9.979). (Task 5)
5. `null` sent for `name`, `species`, `sex` or `birthDateEstimated` returns a field error, not a SQLite constraint crash. (Task 4)

---

### Task 1: Scope pet queries by owner and expose `archivedAt`

**Files:**
- Modify: `apps/mobile/src/data/pets/pet-repository.ts`
- Modify: `apps/mobile/src/data/types.ts` (`Pet`)
- Modify: `apps/mobile/src/data/open.ts:167-178`
- Modify: `apps/mobile/src/data/testing/test-data.ts`
- Test: `apps/mobile/src/data/pets/pet-repository.test.ts`

**Interfaces:**
- Produces: `createPetRepository(db: Database, deps: DataDeps, ownerId: string): PetRepository`
- Produces: `Pet.archivedAt: string | null`
- Produces (tests): `addOtherOwnerPet(db: Database): Promise<{ ownerId: string; petId: string }>` in `testing/test-data.ts` — drops the `owners_single` index, inserts a second owner (`profile_completed_at` set) and one active `DOG` named `Other` for them, returns both IDs.

- [ ] **Step 1: Write the failing tests** in `pet-repository.test.ts`, `describe('pet repository: owner scoping')`:

```ts
it('never shows another owner\'s pet', async () => {
  const { pets, db } = await ready();
  const mine = await pets.create({ name: 'Mochi', species: 'CAT' });
  const other = await addOtherOwnerPet(db);
  expect((await pets.list()).data.map((p) => p.id)).toEqual([mine.id]);
  const e = await rejection(pets.get(other.petId));
  expect([e.code, e.message, e.details]).toEqual(['NOT_FOUND', 'Not found', null]);
});

it('reports archivedAt', async () => {
  // create, set archived_at = '2026-11-24T09:00:00.000Z' in SQL as the existing archived test does
  expect((await pets.get(pet.id)).archivedAt).toBe('2026-11-24T09:00:00.000Z');
});
```

Also add `archivedAt: null` to the `toEqual` in `creates a minimal pet with defaults`, and in `hides archived pets from the list but not from get` compare with `{ ...pet, archivedAt: '2026-11-24T09:00:00.000Z' }`.

- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/pets` — expected FAIL (`addOtherOwnerPet` missing, `archivedAt` undefined).

- [ ] **Step 3: Implement.** Add the `ownerId` parameter; `create` reads the owner with `WHERE id = ?` instead of `LIMIT 1`; add `owner_id = ?` to `list`, `get` and the read-back after insert; map `archived_at` to `archivedAt` in `toPet`. In `open.ts` keep the ID returned by `ensureOwner` and pass it; in `openTestData` pass the existing `ownerId`. Write `addOtherOwnerPet`.

- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.

- [ ] **Step 5: Commit** `PF-03: Scope pet queries by owner and expose archivedAt`

### Task 2: Migration 0002 `pet_selection`

**Files:**
- Create: `apps/mobile/src/data/migrations/0002-pet-selection.ts`
- Modify: `apps/mobile/src/data/migrations/index.ts` (`MIGRATIONS`)
- Modify: `apps/mobile/src/data/database.ts:3` (`TableName`)
- Test: `apps/mobile/src/data/migrations/schema.test.ts`, `apps/mobile/src/data/open.test.ts:113`

**Interfaces:**
- Produces: `migration0002: Migration` (`version: 2`, `name: 'pet-selection'`), `LATEST_VERSION === 2`
- Produces: `TableName = 'owners' | 'pets' | 'pet_selection' | 'change_log'`

- [ ] **Step 1: Write the failing tests** in `schema.test.ts`:
  - `applies every migration once`: replaces `applies 0001 once`; expects `{ from: 0, to: 2 }`, `user_version` 2, then `{ from: 2, to: 2 }`.
  - `pet_selection accepts the owner's own pet`: `addOwner()`, `addPet()`, insert `(OWNER, PET, NOW)` resolves.
  - `pet_selection rejects another owner's pet`: drop `owners_single`, add a second owner and give PET to them, insert `(OWNER, PET, NOW)` rejects.
  - `pet_selection rejects an unknown pet` and `keeps one row per owner` (second insert for OWNER rejects).
  - In `open.test.ts:113` expect `userVersion` to be `LATEST_VERSION` (import it).

- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/migrations src/data/open.test.ts` — expected FAIL.

- [ ] **Step 3: Implement** `0002-pet-selection.ts` with exactly the `CREATE TABLE pet_selection` SQL from the design (owner_id PK → owners, `pet_id TEXT NOT NULL`, `selected_at TEXT NOT NULL`, `FOREIGN KEY (owner_id, pet_id) REFERENCES pets (owner_id, id)`), plus `CHECK (length(pet_id) = 36)`. Append it to `MIGRATIONS`; extend `TableName`.

- [ ] **Step 4: Run** the same command — expected PASS.

- [ ] **Step 5: Commit** `PF-03: Add the pet_selection migration`

### Task 3: `pets.selected()`, `pets.select(id)`, and create selects the new pet

**Files:**
- Modify: `apps/mobile/src/data/pets/pet-repository.ts`
- Test: `apps/mobile/src/data/pets/pet-selection.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 `createPetRepository(..., ownerId)`, `addOtherOwnerPet`; Task 2 `pet_selection`.
- Produces on `PetRepository`: `selected(): Promise<Pet | null>`; `select(id: string): Promise<Pet>`.

- [ ] **Step 1: Write the failing tests** (`describe('pet selection')`, using `ready()` copied from the pet tests or moved to `testing/test-data.ts` as `openReadyTestData()`):
  - `returns null with no pets`: `expect(await pets.selected()).toBeNull()`.
  - `selects a newly created pet`: create A then B → `selected()` is B.
  - `select switches and survives a new repository`: create A, B; `select(A.id)` returns A; `createPetRepository(db, deps, ownerId).selected()` is A.
  - `falls back to the oldest active pet when the selected one is archived`: create A, B (B selected); archive B in SQL → `selected()` is A; the `pet_selection` row still holds B (reading never writes).
  - `returns null when every pet is archived`.
  - `refuses unknown, malformed, archived and other-owner pets`: each `select(id)` → `NOT_FOUND`, `Not found`, details `null`; selection unchanged.
  - `create rolls back the selection with the pet`: reuse the `newId` → `'bad'` spy; `pet_selection` has 0 rows.

- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/pets` — expected FAIL.

- [ ] **Step 3: Implement.** `selected()` in one `db.read`: the joined active selected pet for `ownerId`, else `SELECT * FROM pets WHERE owner_id = ? AND archived_at IS NULL ORDER BY id LIMIT 1`, else `null`. `select(id)` in `db.write(['pet_selection'])`: UUID check, read the active pet by `owner_id` + `id` (else `notFound()`), then `INSERT … ON CONFLICT (owner_id) DO UPDATE SET pet_id = excluded.pet_id, selected_at = excluded.selected_at`. `create` declares `['pets', 'pet_selection', 'change_log']` and upserts the selection after the insert. No `change_log` row for selection.

- [ ] **Step 4: Run** the same command — expected PASS.

- [ ] **Step 5: Commit** `PF-03: Store the selected pet with an archived fallback`

### Task 4: `UpdatePetInput` and its shape check

**Files:**
- Modify: `apps/mobile/src/data/types.ts`
- Modify: `apps/mobile/src/data/pets/pet-input.ts`
- Test: `apps/mobile/src/data/pets/pet-input.test.ts` (new)

**Interfaces:**
- Produces:

```ts
export interface UpdatePetInput {
  id: string;
  version: number;
  name?: string;
  species?: Pet['species'];
  speciesOther?: string | null;
  breed?: string | null;
  sex?: Pet['sex'];
  birthDate?: string | null;
  birthDateEstimated?: boolean;
  weight?: { value: number; unit: 'KG' | 'LB' } | null;
  weightMeasuredOn?: string | null;
  microchip?: string | null;
}
export function parseUpdatePetInput(input: unknown): UpdatePetInput; // pet-input.ts
```

- [ ] **Step 1: Write the failing tests** in `pet-input.test.ts`:
  - accepts `{ id, version: 1 }` alone and `null` for each of `speciesOther`, `breed`, `birthDate`, `weight`, `weightMeasuredOn`, `microchip`.
  - `null` or wrong type for `name` → `[INVALID]`; `species: null` → `[CHOOSE_SPECIES]`; `sex: null` → `[CHOOSE_SEX]`; `birthDateEstimated: null` → `[INVALID]`.
  - `version` 0, 1.5, `'1'` or above `MAX_INT4` → `[VERSION]`; `id` missing or not a string → `[INVALID]`.
  - unknown key `ownerId` → `[NOT_ALLOWED]`; weight `{ value: 'x', unit: 'ST' }` → `[WEIGHT_NUMBER, CHOOSE_UNIT]`.
  - all errors in one `VALIDATION_FAILED`.

- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/pets/pet-input.test.ts` — expected FAIL.

- [ ] **Step 3: Implement** `parseUpdatePetInput`, sharing the weight and optional-string checks with `parseCreatePetInput` (extract a helper in the same file). An `id` that is a string but not a UUID passes the shape check; the repository answers it with `NOT_FOUND`.

- [ ] **Step 4: Run** — expected PASS.

- [ ] **Step 5: Commit** `PF-03: Add the pet update input check`

### Task 5: `pets.update`

**Files:**
- Modify: `apps/mobile/src/data/pets/pet-repository.ts`
- Test: `apps/mobile/src/data/pets/pet-update.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 scoping, Task 4 `UpdatePetInput`/`parseUpdatePetInput`.
- Produces on `PetRepository`: `update(input: UpdatePetInput): Promise<Pet>`.

**Merge rules** (the "next" value of each field is the change if sent, else the current row; errors collected into one `VALIDATION_FAILED`):

| Field | Rule |
| --- | --- |
| `name`, `breed`, `microchip` | string → same core rule as create (`normalizePetName`, `normalizeOptionalText(…, 100, 'Enter a breed of 1–100 characters.')`, `normalizeMicrochip`); `null` clears breed/microchip |
| `speciesOther` | next species `OTHER`: sent string → `normalizeOptionalText(…, 100, 'Describe the species in 1–100 characters.')`; nothing current and nothing sent, or `null` sent → that same message. Next species not `OTHER`: a sent string → `'Only add a description when the species is Other.'`; otherwise cleared |
| `birthDate` | string → `checkPastOrToday(…, today, "The birth date can't be in the future.")`; `null` clears |
| `birthDateEstimated` | next birth date `null`: sent `true` → `'Add a birth date to mark it as estimated.'`, otherwise `false` |
| `weight` | object → `toGrams`; `null` clears |
| `weightMeasuredOn` | next weight `null`: sent string → `'Add a weight for this measurement date.'`, otherwise cleared. Weight present: sent string → `checkPastOrToday(…, "The measurement date can't be in the future.")`; sent `null` → `'A weight needs a measurement date.'`; not sent and a new weight sent → `today`; otherwise kept |

`today = localDate(owner.time_zone, deps.now())`. Changed fields are those whose next column value differs from the row, named `name, species, speciesOther, breed, sex, birthDate, birthDateEstimated, currentWeightKg, weightMeasuredOn, microchip` (the names `create` logs). Conflict message: `'This pet was changed elsewhere. Review the latest version and try again.'`

- [ ] **Step 1: Write the failing tests** (pet created via `ready()` + `create`, owner zone `Asia/Manila`):
  - `updates fields and bumps the version`: rename to `Mochi II`, sex `FEMALE` → returns new values, `version` 2, same `id`; `get` matches.
  - `clears optional fields`: create with breed, birth date + estimated, weight, microchip; update all four to `null` → `breed`, `birthDate`, `currentWeightKg`, `weightMeasuredOn`, `microchip` null and `birthDateEstimated` false.
  - `stores an LB weight like create`: `weight: { value: 22, unit: 'LB' }` → `currentWeightKg` 9.979, `weightMeasuredOn` `'2026-11-24'`.
  - `applies the PF-02 rules`: future birth date, weight `{ value: 0, unit: 'KG' }`, name `'  '` in one call → three field errors; the row is unchanged.
  - each Merge rules row: Other without description, description on CAT, CAT→OTHER with a description, OTHER→DOG clears the description, estimated without birth date, date without weight, `weightMeasuredOn: null` with a weight.
  - `uses the owner's local date`: `openTestData({ now: new Date('2026-11-24T17:00:00Z') })` (Manila 25 Nov) accepts birth date `'2026-11-25'`.
  - `refuses a stale version`: update with `version: 1` twice → second throws `CONFLICT`, `details.current.version` 2; the row and log are unchanged. Same with no changed fields.
  - `returns the pet unchanged for a no-op`: same values, current version → `version` 1, no new log row.
  - `refuses archived, unknown, malformed and other-owner pets` with `NOT_FOUND`, `Not found`, details `null` — including when the input also breaks a field rule (e.g. a future birth date), so the not-found check runs before the merge rules.
  - `allows a name another pet has`.
  - `writes one pet.updated row with field names only`: fields `['name', 'microchip']` for those two changes; the JSON contains no value.
  - `rolls back when the change log fails`: spy `deps.newId` → `'bad'` (used only by the log row) → row and version unchanged.

- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/pets` — expected FAIL.

- [ ] **Step 3: Implement** `update` in `db.write(['pets', 'change_log'])`: parse shape → UUID check and read the active pet by `owner_id` + `id` (else `notFound()`) → read the owner's zone → merge rules → no-op/version check as in `owner-repository.ts:134-137` → `UPDATE pets SET … , version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND archived_at IS NULL` (0 rows → `conflict` with the re-read pet) → `recordChange` with `action: 'pet.updated'`. Factor the per-field checks shared with `normalizePet` rather than duplicating them.

- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.

- [ ] **Step 5: Commit** `PF-03: Edit a pet with version checks`

### Task 6: Contract, docs, backlog and full verification

**Files:**
- Modify: `apps/mobile/src/data/index.ts` (export `UpdatePetInput`)
- Modify: `apps/mobile/AGENTS.md` ("Data layer" section)
- Modify: `docs/backlog.csv`

- [ ] **Step 1:** Export `UpdatePetInput` from `index.ts`. In `AGENTS.md` add a bullet: pet repositories are created with the owner ID and every query filters by it; the selected pet is `pets.selected()` / `pets.select(id)` (watch `['pets', 'pet_selection']` with `useLiveQuery`), is a device preference with no change-log row, and falls back to the oldest active pet.
- [ ] **Step 2:** Backlog: PF-03 → `In Progress`; add `PF-03-APP,Pet switcher and edit screens on the phone data layer,Task,PF,High,Proposed,PF-03 LOCAL-01,docs/spec/epics/PF.md` after PF-03; LOCAL-01 → `Done`; PF-01, PF-02 → `Done`; FN-01 → `In Review`.
- [ ] **Step 3: Run** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e` — expected all green.
- [ ] **Step 4: Commit** `PF-03: Document the pet selection contract and update the backlog`
