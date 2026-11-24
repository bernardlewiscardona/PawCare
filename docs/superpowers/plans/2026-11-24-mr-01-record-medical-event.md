# MR-01 Record a Medical Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `care_records` parent and `medical_events` subtype to the phone database, with an owner-scoped `medical` repository (create, get, listForPet) and a reusable "save anyway?" confirmation.

**Architecture:** Shared field rules and the new error code go in `packages/core`. Migration 0003 adds the two tables and rebuilds `change_log` to accept care records. `src/data/medical` holds the input check and the repository, created with the owner ID like the pet repository, writing parent + subtype + change log in one `db.write`.

**Tech Stack:** TypeScript, SQLite (`expo-sqlite` in the app, `node:sqlite` in tests), Vitest, `@pawcare/core`.

**Spec:** `docs/superpowers/specs/2026-11-24-mr-01-record-medical-event-design.md` (and `docs/spec/epics/MR.md`, MR-01)

## Global Constraints

- Branch `MR-01-record-medical-event`; commits `MR-01: <imperative summary>`; no Claude trailers.
- Don't change `apps/api` or the Prisma schema. `packages/core` changes are additive; after editing core run `pnpm --filter @pawcare/core build` before mobile tests see them.
- Migrations are append-only: never edit 0001 or 0002.
- Every query filters by `owner_id`. SQL uses bound parameters only.
- `change_log` rows hold field names only — never title, notes or provider text.
- Records are always `provenance: 'OWNER_ENTERED'`; never use "verified" wording.
- Copy fixed by the design: future date → `A medical event can't be in the future. Add planned visits in Appointments.`; before birth → `This date is before {pet name}'s birth date. Save anyway?`
- Mobile tests: `pnpm --filter mobile exec vitest run <path>`; core tests: `pnpm --filter @pawcare/core exec vitest run <path>`.
- Before finishing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e` (e2e needs `apps/api/.env` and `docker compose up -d db`).

## Review Focus

1. Notes or provider that are only whitespace are stored as `null`, not `''` and not an error. (Task 1, Task 3)
2. A 150-emoji title is accepted by core and by the SQLite `CHECK` alike (both count code points). (Task 1, Task 2)
3. An event dated exactly on the pet's birth date is not "before birth" — no warning; a pet with no birth date never warns. (Task 4)
4. A `listForPet` cursor from another pet or another owner gives the same cursor field error as a made-up ID, revealing nothing. (Task 5)
5. Upgrading a real version-2 database keeps every existing `change_log` row, and the rebuilt table is still append-only. (Task 2)

---

### Task 1: Core medical rules and `CONFIRMATION_REQUIRED`

**Files:**
- Create: `packages/core/src/medical-rules.ts`, `packages/core/src/medical-rules.spec.ts`
- Modify: `packages/core/src/constants.ts`, `packages/core/src/errors.ts`, `packages/core/src/index.ts`

**Interfaces:**
- Produces: `MEDICAL_EVENT_TYPES = ['VISIT', 'DIAGNOSIS', 'PROCEDURE', 'ALLERGY', 'GENERAL_NOTE'] as const` (constants.ts)
- Produces: `ErrorCode.CONFIRMATION_REQUIRED = 'CONFIRMATION_REQUIRED'` (doc comment: a warning the owner can override by resending with the named `confirm…` flag)
- Produces (medical-rules.ts):
  - `normalizeMedicalTitle(value: string): string | RuleError` — trimmed, 1–150 code points, error `Enter a title of 1–150 characters.`
  - `normalizeMedicalNotes(value: string): string | null | RuleError` — trimmed; empty → `null`; over 5,000 code points → `Keep notes to 5,000 characters.`
  - `normalizeProviderName(value: string): string | null | RuleError` — trimmed; empty → `null`; over 150 → `Enter a provider name of up to 150 characters.`
  - `checkMedicalEventDate(value: string, today: string): string | RuleError` — `checkPastOrToday` with the future-date copy from Global Constraints.

- [ ] **Step 1: Write the failing tests** in `medical-rules.spec.ts`: title `' Check-up '` → `'Check-up'`; `''`, `'   '` and 151 characters → the title error; `'🐾'.repeat(150)` accepted, `'🐾'.repeat(151)` rejected. Notes `'  '` → `null`, 5,000 `'a'` accepted, 5,001 rejected. Provider `''` → `null`, `' Dr Cruz '` → `'Dr Cruz'`, 151 rejected. Date `'2026-11-25'` with today `'2026-11-24'` → `{ error: "A medical event can't be in the future. Add planned visits in Appointments." }`; `'1899-12-31'` → `{ error: 'Enter a valid date.' }`; `'2026-11-24'` accepted. `MEDICAL_EVENT_TYPES` has the five values in order.
- [ ] **Step 2: Run** `pnpm --filter @pawcare/core exec vitest run src/medical-rules.spec.ts` — expected FAIL (module missing).
- [ ] **Step 3: Implement** the four functions (reuse `normalizeOptionalText`, `checkPastOrToday`), the constant, the error code, and export all from `index.ts`.
- [ ] **Step 4: Run** `pnpm --filter @pawcare/core exec vitest run && pnpm --filter @pawcare/core build` — expected PASS.
- [ ] **Step 5: Commit** `MR-01: Add the medical event field rules to core`

### Task 2: Migration 0003 — care records, medical events, change log rebuild

**Files:**
- Create: `apps/mobile/src/data/migrations/0003-care-records.ts`, `apps/mobile/src/data/migrations/schema-0003.test.ts`
- Modify: `apps/mobile/src/data/migrations/index.ts`, `apps/mobile/src/data/migrations/schema.test.ts` (version assertions), `apps/mobile/src/data/database.ts` (`TableName`), `apps/mobile/src/data/change-log.ts` (`ChangeEntry.entityType`)

**Interfaces:**
- Produces: `migration0003` (`version: 3`, `name: 'care-records'`), `LATEST_VERSION === 3`
- Produces: `TableName` adds `'care_records' | 'medical_events'`; `ChangeEntry.entityType: 'owner' | 'pet' | 'care_record'`

- [ ] **Step 1: Write the failing tests** in `schema-0003.test.ts` (same helpers style as `schema.test.ts`: owner, pet, fixed UUIDs, `NOW`):
  - inserts a `care_records` row (kind `MEDICAL`) and its `medical_events` row.
  - rejects: kind `'X'`; status `'VOIDED'` without reason/`voided_at`; `ACTIVE` with a `void_reason`; `APPOINTMENT` with status `VOIDED` (reason set); provenance `'VERIFIED'`; `occurrence_date '2026-02-30'`; a `care_records` row for another owner's pet (drop `owners_single` first) → `/FOREIGN KEY/`.
  - rejects a `medical_events` row whose parent has kind `VACCINE` → `/FOREIGN KEY/`; kind `'VACCINE'` on the subtype → `/CHECK/`; title `'  '`; title `'🐾'.repeat(151)` while `'🐾'.repeat(150)` passes; notes of 5,001 characters; provider `''`.
  - `change_log` accepts `entity_type 'care_record'`, still rejects `'x'`, and still raises `/append-only/` on UPDATE and DELETE.
  - **upgrade from version 2**: on a fresh connection exec `migration0001.sql`, `migration0002.sql`, set `PRAGMA user_version = 2`, insert two `change_log` rows; `migrate()` returns `{ from: 2, to: 3 }` and both rows are still there, byte-for-byte.
  - In `schema.test.ts` update `applies every migration once` to `{ from: 0, to: 3 }` / `user_version: 3` / `{ from: 3, to: 3 }`.
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/migrations` — expected FAIL. Check each `rejects` test fails because the table is missing, then is pinned to its constraint (`/CHECK/`, `/FOREIGN KEY/`) so it can't pass vacuously.
- [ ] **Step 3: Implement** `0003-care-records.ts` with exactly the two `CREATE TABLE`s and the index from the design, then the `change_log` rebuild in this order (DROP TABLE's implicit delete fires no triggers):

```sql
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
INSERT INTO change_log_v2 SELECT id, owner_id, entity_type, entity_id, entity_version, action, fields, occurred_at FROM change_log;
DROP TABLE change_log;
ALTER TABLE change_log_v2 RENAME TO change_log;
-- then recreate change_log_no_update and change_log_no_delete exactly as in 0001
```

  Append to `MIGRATIONS`; widen `TableName` and `ChangeEntry.entityType`.
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `MR-01: Add the care_records and medical_events migration`

### Task 3: `medical.create` and `medical.get`

**Files:**
- Create: `apps/mobile/src/data/medical/medical-input.ts`, `apps/mobile/src/data/medical/medical-repository.ts`, `apps/mobile/src/data/medical/medical-repository.test.ts`
- Modify: `apps/mobile/src/data/types.ts`, `apps/mobile/src/data/shape.ts`, `apps/mobile/src/data/open.ts` (`PawCareData.medical`), `apps/mobile/src/data/testing/test-data.ts`

**Interfaces:**
- Consumes: Task 1 rules and `MEDICAL_EVENT_TYPES`; Task 2 tables; `addOtherOwnerPet`, `openReadyTestData` from `testing/test-data.ts`.
- Produces: `MedicalEvent`, `CreateMedicalEventInput` exactly as in the design's Contract (types.ts); `CHOOSE_EVENT_TYPE = 'Choose an event type.'` (shape.ts)
- Produces: `parseCreateMedicalEventInput(input: unknown): CreateMedicalEventInput` — allowed keys `petId, eventType, title, occurrenceDate, notes, providerName, confirmBeforeBirth`; `petId`, `title`, `occurrenceDate` required strings (`REQUIRED` / `INVALID`); `eventType` in the list (`CHOOSE_EVENT_TYPE`); `notes`, `providerName` optional strings; `confirmBeforeBirth` optional boolean; unknown keys `NOT_ALLOWED`.
- Produces: `MedicalRepository { create(input): Promise<MedicalEvent>; get(id: string): Promise<MedicalEvent> }`, `createMedicalRepository(db: Database, deps: DataDeps, ownerId: string): MedicalRepository`; `openTestData()` and `PawCareData` gain `medical`.

- [ ] **Step 1: Write the failing tests** (`describe('medical repository: create and get')`, pet from `openReadyTestData()` + `pets.create({ name: 'Mochi', species: 'CAT' })`, now `2026-11-24T08:00:00Z`, zone Asia/Manila):
  - `creates an owner-entered event`: `{ petId, eventType: 'VISIT', title: ' Check-up ', occurrenceDate: '2026-11-20', notes: 'Healthy', providerName: 'Dr Cruz' }` → `toEqual({ id, petId, eventType: 'VISIT', title: 'Check-up', occurrenceDate: '2026-11-20', notes: 'Healthy', providerName: 'Dr Cruz', status: 'ACTIVE', provenance: 'OWNER_ENTERED', voidReason: null, voidedAt: null, version: 1, createdAt: '2026-11-24T08:00:00.000Z', updatedAt: '2026-11-24T08:00:00.000Z' })`; `get(id)` equals it.
  - `accepts every event type` (loop over the five).
  - `stores blank notes and provider as null` (`notes: '   '`, `providerName: ''`).
  - `reports every field error at once`: title `''`, notes 5,001 chars, date `'2026-11-25'` → one `VALIDATION_FAILED` with exactly `title`, `notes`, `occurrenceDate`; the date message is the future-date copy; nothing written.
  - `uses the owner's local date`: now `2026-11-24T17:00:00Z` accepts `'2026-11-25'`.
  - `checks the shape`: missing `title`/`occurrenceDate` → `REQUIRED`; `eventType: 'SURGERY'` → `CHOOSE_EVENT_TYPE`; `ownerId: 'x'` → `NOT_ALLOWED`; `confirmBeforeBirth: 'yes'` → `INVALID`.
  - `saves identical events twice` (two distinct IDs).
  - `refuses archived, unknown, malformed and other-owner pets the same way` — each with and without a future date → `NOT_FOUND`, `Not found`, details `null`.
  - `get refuses another owner's record and unknown IDs` (insert another owner's pet + record directly in SQL after `addOtherOwnerPet`).
  - `writes one parent, one subtype and one change_log row`: counts 1/1/1; log `entity_type 'care_record'`, `action 'medical_event.created'`, `entity_version 1`, fields `['eventType', 'notes', 'occurrenceDate', 'petId', 'providerName', 'title']` when sorted; the row's JSON contains neither `Check-up`, `Healthy` nor `Dr Cruz`.
  - `leaves nothing behind when the change log fails`: spy `deps.newId` → returns a valid UUID first (the record) then `'bad'` → `care_records` and `medical_events` both 0 rows.
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/medical` — expected FAIL.
- [ ] **Step 3: Implement.** `create`: shape check → `db.write(['care_records', 'medical_events', 'change_log'], …)`: read the active pet by `owner_id` + `id` (UUID check first; else `notFound()`) → owner's `time_zone` → `localDate` → Task 1 rules into one `VALIDATION_FAILED` → insert `care_records` (kind `MEDICAL`), `medical_events`, then `recordChange` (field names: `petId`, `eventType`, `title`, `occurrenceDate`, plus `notes`/`providerName` when not null). `get`: join the two tables on `owner_id` + `record_id`, any status, archived pets included. Wire `medical` into `open.ts` and `openTestData`.
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `MR-01: Record and read a medical event`

### Task 4: Confirm a date before the pet's birth

**Files:**
- Modify: `apps/mobile/src/data/errors.ts`, `apps/mobile/src/data/medical/medical-repository.ts`
- Test: `apps/mobile/src/data/medical/medical-confirm.test.ts`

**Interfaces:**
- Consumes: Task 3 `create`.
- Produces: `confirmationRequired(warnings: FieldErrors): DataError` — code `CONFIRMATION_REQUIRED`, message `Confirmation required`, details `{ warnings }`.

- [ ] **Step 1: Write the failing tests** (pet `Mochi` born `'2021-03-14'`):
  - `asks before saving a date before birth`: `occurrenceDate '2021-03-13'` → `CONFIRMATION_REQUIRED`, details `{ warnings: { occurrenceDate: ["This date is before Mochi's birth date. Save anyway?"] } }`; nothing written.
  - `saves when confirmed`: same input + `confirmBeforeBirth: true` → saved.
  - `warns for an estimated birth date too` (`birthDateEstimated: true`).
  - `does not warn on the birth date itself` (`'2021-03-14'`) `or for a pet with no birth date`.
  - `reports field errors before the warning`: date `'2021-03-13'`, title `''`, `confirmBeforeBirth` absent → `VALIDATION_FAILED` (only `title`).
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data/medical` — expected FAIL (records saved without warning).
- [ ] **Step 3: Implement** `confirmationRequired` and, after the field rules pass, the check `occurrenceDate < pet.birth_date && confirmBeforeBirth !== true` (string compare on `YYYY-MM-DD`).
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `MR-01: Ask before saving an event dated before birth`

### Task 5: `medical.listForPet`

**Files:**
- Create: `apps/mobile/src/data/paging.ts`, `apps/mobile/src/data/medical/medical-list.test.ts`
- Modify: `apps/mobile/src/data/pets/pet-repository.ts` (use `paging.ts`), `apps/mobile/src/data/medical/medical-repository.ts`, `apps/mobile/src/data/types.ts`

**Interfaces:**
- Produces: `parsePageQuery(query: { limit?: number; cursor?: string }): { limit: number; cursor?: string }` in `paging.ts` (moved unchanged from the pet repository with `PAGE_SIZE_MESSAGE`, `CURSOR_MESSAGE` and `UUID`); `MedicalEventPage { data: MedicalEvent[]; nextCursor: string | null }`.
- Produces on `MedicalRepository`: `listForPet(petId: string, query?: { limit?: number; cursor?: string }): Promise<MedicalEventPage>`.

- [ ] **Step 1: Write the failing tests**:
  - `lists newest first with the ID as tiebreak`: dates `'2026-01-05'`, `'2026-03-01'`, `'2026-03-01'`, `'2025-12-31'` → order by date desc, then the two same-day records with the later ID first.
  - `pages with a cursor`: 25 records → 20 + 5, `nextCursor` is the 20th ID then `null`, no duplicates or gaps.
  - `shows only this pet's records` (two pets).
  - `still lists an archived pet's records`.
  - `refuses another owner's pet and unknown pets` → `NOT_FOUND`.
  - `rejects a bad limit, and cursors that are malformed, unknown, from another pet or from another owner` → each the same `cursor` field error `Use the nextCursor from the previous page.`; limit 0 and 101 → `Choose a page size of 1–100.`.
  - Existing pet paging tests still pass (shared `parsePageQuery`).
- [ ] **Step 2: Run** `pnpm --filter mobile exec vitest run src/data` — expected FAIL.
- [ ] **Step 3: Implement.** Move `parsePageQuery` to `paging.ts` and import it in the pet repository. `listForPet` in one `db.read`: pet by `owner_id` + `id` (archived allowed; else `notFound()`); a cursor resolves to its `occurrence_date` from `care_records` scoped by `owner_id`, `pet_id` and kind `MEDICAL` (missing → cursor field error); select `ACTIVE` records `WHERE (occurrence_date, id) < (?, ?)` `ORDER BY occurrence_date DESC, id DESC LIMIT limit + 1`.
- [ ] **Step 4: Run** `pnpm --filter mobile exec vitest run src/data` — expected PASS.
- [ ] **Step 5: Commit** `MR-01: List a pet's medical events`

### Task 6: Contract, docs, backlog and full verification

**Files:**
- Modify: `apps/mobile/src/data/index.ts`, `apps/mobile/AGENTS.md` ("Data layer"), `docs/backlog.csv`

- [ ] **Step 1:** Export `MedicalEvent`, `CreateMedicalEventInput`, `MedicalEventPage` from `index.ts`. In `AGENTS.md` add bullets: health records are a `care_records` parent plus exactly one subtype row written in the same `db.write` (SQLite can't check this at commit; the repository and tests do, and AUTH-01's upload must re-check it); `CONFIRMATION_REQUIRED` carries `details.warnings` per field and the screen resends with the named `confirm…` flag (first use: `confirmBeforeBirth`); watch `['care_records', 'medical_events']` with `useLiveQuery`.
- [ ] **Step 2:** Backlog: MR-01 → `In Progress`; add after MR-01 `MR-01-APP,Medical event screens on the phone data layer,Task,MR,High,Proposed,MR-01 LOCAL-01,docs/spec/epics/MR.md`.
- [ ] **Step 3: Run** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test` — expected all green; then `pnpm test:e2e` if `apps/api/.env` exists (the API is unchanged; CI runs it otherwise).
- [ ] **Step 4: Commit** `MR-01: Document the medical event contract and update the backlog`
