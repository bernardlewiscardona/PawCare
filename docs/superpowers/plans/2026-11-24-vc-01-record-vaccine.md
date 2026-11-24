# VC-01 Record a Vaccine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vaccinations and their documented next due dates to the phone data layer, as the second record kind on `care_records`, with owner-scoped create/get/list, derived Overdue and two "save anyway?" warnings.

**Architecture:** Vaccine field rules go in `packages/core`. The care-record steps MR-01 wrote inline (active pet, owner's today, parent insert, before-birth text) move to `src/data/care-records/` and both repositories use them. Migration 0004 adds `vaccinations` and `vaccine_due_items`; `src/data/vaccines` mirrors `src/data/medical`.

**Tech Stack:** TypeScript, SQLite (`expo-sqlite` in the app, `node:sqlite` in tests), Vitest, `@pawcare/core`.

**Spec:** `docs/superpowers/specs/2026-11-24-vc-01-record-vaccine-design.md` (and `docs/spec/epics/VC.md`, VC-01)

## Global Constraints

- Branch `VC-01-record-vaccine`; commits `VC-01: <imperative summary>`; no Claude trailers.
- Don't change `apps/api`. `packages/core` changes are additive; run `pnpm --filter @pawcare/core build` after editing core.
- Migrations are append-only: never edit 0001–0003. No `change_log` rebuild in this story.
- Every query filters by `owner_id`; bound parameters only; `change_log` holds field names only.
- No inferred schedule: no `nextDueOn` given → no due item, `nextDue: null`. Overdue is never stored.
- Copy fixed by the design: `The vaccination date can't be in the future.`; `The next due date can't be before the vaccination date.`; `You already recorded {name} for {pet name} on this date. Save anyway?`; `This date is before {pet name}'s birth date. Save anyway?`
- `medical.*` behaviour must not change: its existing tests pass without edits.
- Tests: `pnpm --filter mobile exec vitest run <path>`, `pnpm --filter @pawcare/core exec vitest run <path>`.
- Before finishing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test` (`pnpm test:e2e` only if `apps/api/.env` exists).

## Review Focus

1. "Similar" ignores case and surrounding spaces (`' rabies '` vs `'Rabies'`) but not a different name (`'Rabies 3-year'`), and never counts a VOIDED vaccination. (Task 5)
2. A due date equal to the owner's local today is not overdue; one day earlier is, judged in the owner's zone near midnight. (Task 4)
3. With both warnings pending, confirming only one still returns the other. (Task 5)
4. The due item carries the same owner, pet and vaccination as its record, so VC-04 and reminders can join it. (Task 4)
5. Moving the shared care-record steps changes nothing for medical events: the MR-01 tests pass untouched. (Task 2)

---

### Task 1: Core vaccine rules

**Files:**
- Create: `packages/core/src/vaccine-rules.ts`, `packages/core/src/vaccine-rules.spec.ts`
- Modify: `packages/core/src/pet-rules.ts` (extract `checkDate`), `packages/core/src/index.ts`

**Interfaces:**
- Produces (pet-rules.ts): `checkDate(value: string): string | RuleError` — real `YYYY-MM-DD` from 1900, else `{ error: 'Enter a valid date.' }`; `checkPastOrToday` now calls it (behaviour unchanged).
- Produces (vaccine-rules.ts):
  - `normalizeVaccineName(value: string): string | RuleError` — 1–150 trimmed code points, `Enter a vaccine name of 1–150 characters.`
  - `normalizeBatchLabel(value: string): string | null | RuleError` — trimmed; blank → `null`; over 100 → `Enter a batch of up to 100 characters.`
  - `checkVaccinationDate(value: string, today: string): string | RuleError` — future → `The vaccination date can't be in the future.`
  - `checkNextDueDate(value: string, administeredOn: string): string | RuleError` — `checkDate`, then before `administeredOn` → `The next due date can't be before the vaccination date.`

- [ ] **Step 1: Write the failing tests** in `vaccine-rules.spec.ts`: name `' Rabies '` → `'Rabies'`, `''`/151 chars → error, `'🐾'.repeat(150)` ok; batch `'  '` → `null`, `' A12 '` → `'A12'`, 101 chars → error; vaccination date `'2026-11-25'` with today `'2026-11-24'` → the future error, `'1899-12-31'` → `Enter a valid date.`; next due `'2026-01-09'` with administered `'2026-01-10'` → the before error, `'2026-01-10'` (same day) ok, `'2020-01-01'` with administered `'2019-06-01'` ok (past due is valid), `'2026-02-30'` → `Enter a valid date.`. Existing `pet-rules.spec.ts` stays untouched.
- [ ] **Step 2: Run** `pnpm --filter @pawcare/core exec vitest run src/vaccine-rules.spec.ts` — expected FAIL (module missing).
- [ ] **Step 3: Implement** `checkDate` (extracted from `checkPastOrToday`) and the four functions; export all five from `index.ts`.
- [ ] **Step 4: Run** `pnpm --filter @pawcare/core exec vitest run && pnpm --filter @pawcare/core build` — expected PASS.
- [ ] **Step 5: Commit** `VC-01: Add the vaccine field rules to core`

### Task 2: Shared care-record steps

**Files:**
- Create: `apps/mobile/src/data/care-records/care-record.ts`, `apps/mobile/src/data/care-records/care-record.test.ts`
- Modify: `apps/mobile/src/data/medical/medical-repository.ts` (use the helpers; no behaviour change)

**Interfaces:**
- Produces (care-record.ts):
  - `interface ActivePet { id: string; name: string; birth_date: string | null }`
  - `readActivePet(c: SqlConnection, ownerId: string, petId: string): Promise<ActivePet | undefined>` — UUID check, `archived_at IS NULL`, owner-scoped.
  - `readOwnedPetId(c: SqlConnection, ownerId: string, petId: string): Promise<string | undefined>` — archived allowed (for lists).
  - `ownerToday(c: SqlConnection, ownerId: string, deps: DataDeps): Promise<string>` — `localDate(owner time_zone, deps.now())`.
  - `insertCareRecord(c: SqlConnection, row: { id: string; ownerId: string; petId: string; kind: 'MEDICAL' | 'VACCINE'; occurrenceDate: string; at: string }): Promise<void>`
  - `beforeBirthWarning(pet: ActivePet, date: string): string | null` — `This date is before {pet.name}'s birth date. Save anyway?` when `pet.birth_date !== null && date < pet.birth_date`, else `null`.

- [ ] **Step 1: Write the failing tests** in `care-record.test.ts` (via `openReadyTestData`): `readActivePet` returns `{ id, name: 'Mochi', birth_date: '2021-03-14' }` for the owner's pet and `undefined` for archived, malformed, unknown and other-owner (`addOtherOwnerPet`) IDs; `readOwnedPetId` returns the archived pet's ID; `ownerToday` is `'2026-11-25'` at `2026-11-24T17:00:00Z` (Manila); `beforeBirthWarning` returns the text for `'2021-03-13'`, `null` for `'2021-03-14'` and for a pet with no birth date.
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/care-records` — expected FAIL (module missing).
- [ ] **Step 3: Implement** the helpers and switch `medical-repository.ts` to them (its local `readActivePet`, owner time-zone read, parent insert and warning text go away).
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data && git diff --stat -- apps/mobile/src/data/medical/*.test.ts` — expected PASS, and no changes to any medical test file.
- [ ] **Step 5: Commit** `VC-01: Share the care-record steps between record kinds`

### Task 3: Migration 0004 — vaccinations and due items

**Files:**
- Create: `apps/mobile/src/data/migrations/0004-vaccinations.ts`, `apps/mobile/src/data/migrations/schema-0004.test.ts`
- Modify: `apps/mobile/src/data/migrations/index.ts`, `apps/mobile/src/data/migrations/schema.test.ts` (versions → 4), `apps/mobile/src/data/migrations/schema-0003.test.ts` (its upgrade test expects `{ from: 2, to: 4 }`), `apps/mobile/src/data/database.ts` (`TableName` adds `'vaccinations' | 'vaccine_due_items'`)

**Interfaces:**
- Produces: `migration0004` (`version: 4`, `name: 'vaccinations'`), `LATEST_VERSION === 4`, the exact SQL from the design.

- [ ] **Step 1: Write the failing tests** in `schema-0004.test.ts` (helpers like `schema-0003.test.ts`; a VACCINE `care_records` parent at `RECORD` and a second at `RECORD2`):
  - accepts a vaccination and a due item for it.
  - rejects (each pinned to `/CHECK/` or `/FOREIGN KEY/`): a vaccination whose parent is kind `MEDICAL`; subtype kind `'MEDICAL'`; name `'  '`; name `'🐾'.repeat(151)` (150 passes); provider `''`; batch `''` and 101 chars; `administered_on '2026-02-30'`; a due item for an unknown vaccination; a due item for another owner's pet (drop `owners_single`); `due_on '2026-13-01'`; `fulfilled_by_vaccination_id` equal to `vaccination_id`.
  - rejects a second due item for the same vaccination and a second due item fulfilled by the same vaccination → `/UNIQUE/`.
  - In `schema.test.ts` the counts become `{ from: 0, to: 4 }`, `user_version: 4`, `{ from: 4, to: 4 }`.
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/migrations` — expected FAIL (tables missing).
- [ ] **Step 3: Implement** `0004-vaccinations.ts` with the design's SQL; append to `MIGRATIONS`; widen `TableName`.
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `VC-01: Add the vaccinations and vaccine_due_items migration`

### Task 4: `vaccines.create` and `vaccines.get`

**Files:**
- Create: `apps/mobile/src/data/vaccines/vaccine-input.ts`, `apps/mobile/src/data/vaccines/vaccine-repository.ts`, `apps/mobile/src/data/vaccines/vaccine-repository.test.ts`
- Modify: `apps/mobile/src/data/types.ts`, `apps/mobile/src/data/open.ts` (`PawCareData.vaccines`), `apps/mobile/src/data/testing/test-data.ts`

**Interfaces:**
- Consumes: Task 1 rules, `normalizeProviderName`; Task 2 helpers; Task 3 tables.
- Produces: `Vaccination`, `CreateVaccinationInput` exactly as in the design (types.ts).
- Produces: `parseCreateVaccinationInput(input: unknown): CreateVaccinationInput` — `petId`, `vaccineName`, `administeredOn` required strings; `providerName`, `batchLabel`, `nextDueOn` optional strings; `confirmSimilar`, `confirmBeforeBirth` optional booleans; unknown keys `NOT_ALLOWED`.
- Produces: `VaccineRepository { create; get }`, `createVaccineRepository(db: Database, deps: DataDeps, ownerId: string): VaccineRepository`; `openTestData()` and `PawCareData` gain `vaccines`.

- [ ] **Step 1: Write the failing tests** (pet `Mochi`, born `'2021-03-14'`; now `2026-11-24T08:00:00Z`, Manila):
  - `records a vaccine with a next due date`: `{ petId, vaccineName: ' Rabies ', administeredOn: '2026-11-20', providerName: 'Dr Cruz', batchLabel: 'A12', nextDueOn: '2027-11-20' }` → `toEqual({ id, petId, vaccineName: 'Rabies', administeredOn: '2026-11-20', providerName: 'Dr Cruz', batchLabel: 'A12', nextDue: { id: <string>, dueOn: '2027-11-20', overdue: false }, status: 'ACTIVE', provenance: 'OWNER_ENTERED', voidReason: null, voidedAt: null, version: 1, createdAt, updatedAt })`; `get` equals it; the parent's `occurrence_date` is `'2026-11-20'`; the due item row has the same `owner_id`, `pet_id` and `vaccination_id = id`.
  - `infers nothing without a due date`: `nextDue: null`, zero `vaccine_due_items` rows.
  - `marks a past due date overdue`: administered `'2020-01-01'`, due `'2021-01-01'` → `overdue: true`.
  - `is not overdue on the due date itself`: due `'2026-11-24'` → `false`; at `2026-11-24T17:00:00Z` (Manila 25 Nov) `get` of the same record → `true` (open a second repository over the same `db` with that clock).
  - `blocks a due date before the vaccination date and allows the same day`.
  - `reports every field error at once`: name `''`, future `administeredOn`, batch 101 chars → exactly `vaccineName`, `administeredOn`, `batchLabel`; nothing written.
  - `checks the shape`: missing `vaccineName` → `REQUIRED`; `confirmSimilar: 'yes'` → `INVALID`; `ownerId` → `NOT_ALLOWED`.
  - `refuses archived, unknown, malformed and other-owner pets the same way` (with and without a field error) → `NOT_FOUND`, `Not found`, `null`.
  - `get refuses another owner's record and unknown IDs`.
  - `writes one change_log row without vaccine text`: `entity_type 'care_record'`, action `vaccination.created`, sorted fields `['administeredOn', 'batchLabel', 'nextDueOn', 'petId', 'providerName', 'vaccineName']`; no `Rabies`, `A12` or `Dr Cruz` in it.
  - `leaves nothing behind when the change log fails`: `newId` → two valid UUIDs (record, due item) then `'bad'` → `care_records`, `vaccinations`, `vaccine_due_items` all 0 rows; assert `newId` was called 3 times and the rejection matches `/CHECK/`.
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/vaccines` — expected FAIL.
- [ ] **Step 3: Implement.** `create`: shape → `db.write(['care_records', 'vaccinations', 'vaccine_due_items', 'change_log'])` → `readActivePet` (else `notFound()`) → `ownerToday` → rules into one `VALIDATION_FAILED` (`checkNextDueDate` only when `administeredOn` is valid) → `insertCareRecord` (kind `VACCINE`, occurrence date = administered on) → vaccination row → due item when `nextDueOn` → `recordChange`. Reads join `care_records`, `vaccinations` and a LEFT JOIN on `vaccine_due_items`; `overdue = dueOn < ownerToday`. Wire into `open.ts` and `openTestData`.
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `VC-01: Record and read a vaccine with its next due date`

### Task 5: Similar-entry and before-birth warnings

**Files:**
- Modify: `apps/mobile/src/data/vaccines/vaccine-repository.ts`
- Test: `apps/mobile/src/data/vaccines/vaccine-confirm.test.ts`

**Interfaces:**
- Consumes: Task 2 `beforeBirthWarning`; `confirmationRequired(warnings)` from `errors.ts`.

- [ ] **Step 1: Write the failing tests** (pet `Mochi` born `'2021-03-14'`, an existing `Rabies` on `'2026-11-20'`):
  - `asks before saving a similar entry`: `' rabies '` on `'2026-11-20'` → `CONFIRMATION_REQUIRED`, details `{ warnings: { vaccineName: ["You already recorded rabies for Mochi on this date. Save anyway?"] } }`; nothing written; then with `confirmSimilar: true` → saved, two records.
  - `does not warn for a later dose or a different name`: `Rabies` on `'2026-11-21'`; `Rabies 3-year` on `'2026-11-20'`; a `Rabies` for another pet on `'2026-11-20'`.
  - `ignores voided vaccinations`: mark the existing parent `VOIDED` in SQL (reason + `voided_at`) → no warning.
  - `asks before a date before birth` (`'2021-03-13'`) and saves with `confirmBeforeBirth: true`.
  - `returns both warnings together and keeps asking for the unconfirmed one`: an existing `Rabies` on `'2021-03-13'` inserted via `confirmBeforeBirth`; a new one the same day → both `vaccineName` and `administeredOn`; with only `confirmSimilar: true` → still `administeredOn`; with both flags → saved.
  - `reports field errors before warnings`.
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/vaccines` — expected FAIL (no warnings yet).
- [ ] **Step 3: Implement**, after the field rules: read the pet's ACTIVE vaccinations on that date (owner- and pet-scoped), compare `trim().toLowerCase()` in JS; build `warnings` (`vaccineName` unless `confirmSimilar === true`, `administeredOn` from `beforeBirthWarning` unless `confirmBeforeBirth === true`); throw `confirmationRequired(warnings)` when any remain. The similar text uses the name as the owner typed it, trimmed.
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `VC-01: Ask before saving a similar vaccine or one dated before birth`

### Task 6: `vaccines.listForPet`

**Files:**
- Modify: `apps/mobile/src/data/vaccines/vaccine-repository.ts`, `apps/mobile/src/data/types.ts`
- Test: `apps/mobile/src/data/vaccines/vaccine-list.test.ts`

**Interfaces:**
- Consumes: `parsePageQuery`, `badCursor` from `paging.ts`; `readOwnedPetId` from Task 2.
- Produces: `VaccinationPage { data: Vaccination[]; nextCursor: string | null }`; `listForPet(petId: string, query?: { limit?: number; cursor?: string }): Promise<VaccinationPage>` on `VaccineRepository`.

- [ ] **Step 1: Write the failing tests**, mirroring `medical-list.test.ts`: newest `administered_on` first with ID tiebreak; 25 records page 20 + 5 with no gaps; only this pet's; an archived pet's still listed; another owner's or unknown pet → `NOT_FOUND`; a cursor that is malformed, unknown, a medical record of the same pet, another pet's vaccination or another owner's → the same `cursor` field error; limit 0 and 101 → the page-size error; each row's `nextDue` is filled.
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/vaccines` — expected FAIL.
- [ ] **Step 3: Implement** like `medical.listForPet`, cursor resolved in `care_records` scoped by owner, pet and kind `VACCINE`; `overdue` from one `ownerToday` read per call.
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `VC-01: List a pet's vaccines`

### Task 7: Contract, docs, backlog and full verification

**Files:**
- Modify: `apps/mobile/src/data/index.ts`, `apps/mobile/AGENTS.md` ("Data layer"), `docs/backlog.csv`

- [ ] **Step 1:** Export `Vaccination`, `CreateVaccinationInput`, `VaccinationPage` from `index.ts`. In `AGENTS.md` add: `vaccines.create/get/listForPet` (watch `['care_records', 'vaccinations', 'vaccine_due_items']`); `nextDue` is `null` when no date was entered (show "No next date recorded", never infer one) and `overdue` is computed when read, so re-read on focus; warnings `confirmSimilar` and `confirmBeforeBirth` can arrive together; shared care-record steps live in `src/data/care-records/`.
- [ ] **Step 2:** Backlog: VC-01 → `In Progress`; add after VC-01 `VC-01-APP,Vaccine screens on the phone data layer,Task,VC,High,Proposed,VC-01 LOCAL-01,docs/spec/epics/VC.md`; MR-01 → `Done`.
- [ ] **Step 3: Run** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test` — expected all green (`pnpm test:e2e` too if `apps/api/.env` exists).
- [ ] **Step 4: Commit** `VC-01: Document the vaccine contract and update the backlog`
