# PF-02 Register a Pet API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners create pets (`POST /v1/pets`, retry-safe), list them and read one, with weights in kg or lb and an owner weight-unit preference.

**Architecture:** A `pets` module (rules, DTOs, service, controller) on the existing `pets` table. A reusable `IdempotencyService` records each create in `idempotency_requests` in the same transaction as the pet, its audit row and its outbox row. A migration adds `owners.weight_unit`.

**Tech Stack:** NestJS 12 (ESM), Prisma 7 + PostgreSQL 16, class-validator / class-transformer, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-11-23-pf-02-register-pet-api-design.md` (read it with this plan).

## Global Constraints

- Backend only; don't touch `apps/mobile`. Relative imports end in `.js`; mocks use `vi.fn()`.
- Follow `apps/api/AGENTS.md`: owner only from `@CurrentOwner()`; lookups by `id` **and** `ownerId`; not-yours and missing are the same `404 NOT_FOUND` "Not found" with `details: null`; `validationFailed(fields)` for domain errors; mutation + audit + outbox in one transaction with field names / IDs only (no pet names, breeds, microchips).
- Add exactly one error code: `IDEMPOTENCY_KEY_REUSED` (409). Never rename existing codes.
- Additions only to `GET`/`PATCH /v1/me`.
- Weight: 1 lb = 0.45359237 kg; stored kg rounded half-up to 3 decimals; valid when >0 and ≤1000 after conversion.
- "Today" for birth and measurement dates is the owner's local date in `owners.time_zone`.
- Local commands need `export PATH=/home/bernard/.nvm/versions/node/v22.23.5/bin:$PATH DATABASE_URL='postgresql://pawcare:pawcare_local@localhost:5432/pawcare?schema=public'`. Create migrations with `--create-only`, then `db:migrate:deploy`; run the drift check after.
- Commits: `PF-02: <imperative summary>`, repository identity, no Claude trailers.

## Review Focus

1. A pound weight that rounds to 0 kg (`{ value: 0.001, unit: 'LB' }`) is rejected as a field error, not stored as 0 (DB CHECK → 500). → Task 2 test.
2. An impossible calendar date (`2026-02-30`) is a field error, not a 500 from PostgreSQL. → Task 2 test.
3. A retried create whose body differs only in key order or surrounding spaces counts as the same request (normalised before hashing). → Task 3 test.
4. An expired idempotency key (older than 24 h) with the same value can be used again and creates a new pet instead of failing on the unique index. → Task 3 test.
5. `?limit=0`, `?limit=101`, `?limit=abc` and a non-UUID `cursor` return 400 on that field, not a 500 or an unbounded list. → Task 4 test.

---

### Task 1: Owner weight unit

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (new enum `WeightUnit { KG LB }` mapped `weight_unit`; `Owner.weightUnit WeightUnit @default(KG) @map("weight_unit")`)
- Create: migration `<ts>_owner_weight_unit`
- Modify: `apps/api/src/owners/dto/owner-response.dto.ts`, `dto/update-owner-profile.dto.ts`, `owners.service.ts`
- Test: `apps/api/test/owner-profile.e2e-spec.ts`, `apps/api/test/owner-identity.e2e-spec.ts`

**Interfaces:**
- Produces: `OwnerResponseDto.weightUnit: 'KG' | 'LB'`; `UpdateOwnerProfileDto.weightUnit?: 'KG' | 'LB'` (`@IfPresent() @IsIn(['KG','LB'])`); `'weightUnit'` added to `PROFILE_FIELDS` after `timeZone`. Prisma enum `WeightUnit` (used by Task 2).

- [ ] **Step 1: Failing tests.** Identity spec: the first-use `toEqual` gains `weightUnit: 'KG'`. Profile spec: after setup, `PATCH { version: 2, weightUnit: 'LB' }` → 200, `weightUnit: 'LB'`, `version: 3`, and the outbox `changedFields` is `['weightUnit']`; `weightUnit: 'STONE'` → 400 on `details.fields.weightUnit`.
- [ ] **Step 2: Run** `pnpm test:e2e`. Expected: these FAIL (`weightUnit` undefined / 200), the rest PASS.
- [ ] **Step 3: Implement** the schema change, `prisma migrate dev --create-only --name owner_weight_unit`, `pnpm --filter api db:migrate:deploy`, `prisma generate`, then the DTO and service changes. Drift check → `No difference detected`.
- [ ] **Step 4: Run** `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `PF-02: Save the owner's weight display unit`, including the design and plan docs and `docs/decisions.md`.

### Task 2: Pet field rules

**Files:**
- Create: `apps/api/src/common/errors/rule-error.ts` (move `RuleError` here, add `isRuleError`); modify `apps/api/src/owners/profile-rules.ts` and `owners.service.ts` to import them from there
- Create: `apps/api/src/common/time/local-date.ts` + `local-date.spec.ts`
- Create: `apps/api/src/pets/pet-rules.ts` + `pet-rules.spec.ts`

**Interfaces:**
- Produces:
  - `interface RuleError { error: string }`, `isRuleError(value: unknown): value is RuleError`
  - `localDate(timeZone: string, now?: Date): string`: `YYYY-MM-DD` in that zone
  - `normalizePetName(value: string): string | RuleError`
  - `normalizeOptionalText(value: string, max: number, error: string): string | RuleError` (trim; 1–max code points)
  - `normalizeMicrochip(value: string): string | RuleError` (trim; `^[A-Za-z0-9]{1,50}$`)
  - `checkPastOrToday(value: string, today: string, futureError: string): string | RuleError` (`YYYY-MM-DD` that is a real calendar date and `<= today`)
  - `toKilograms(value: number, unit: 'KG' | 'LB'): number | RuleError`
- Copy (verbatim): name `Enter a name of 1–100 characters.`; species description `Describe the species in 1–100 characters.`; breed `Enter a breed of 1–100 characters.`; microchip `Enter 1–50 letters or digits.`; invalid date `Enter a valid date.`; future birth date `The birth date can't be in the future.`; future measurement `The measurement date can't be in the future.`; weight `Enter a weight above 0 and up to 1,000 kg.`

- [ ] **Step 1: Failing tests.**
  - `localDate('Asia/Manila', new Date('2026-11-23T17:30:00Z'))` → `'2026-11-24'`; `localDate('UTC', same)` → `'2026-11-23'`.
  - `toKilograms(9.5,'KG')` → `9.5`; `(22,'LB')` → `9.979`; `(0.002,'LB')` → `0.001`; `(1000,'KG')` → `1000`; `(0,'KG')`, `(-1,'KG')`, `(1000.001,'KG')`, `(2205,'LB')`, `(0.001,'LB')` → weight error.
  - `checkPastOrToday('2026-11-24','2026-11-24',…)` ok; `('2026-11-25','2026-11-24',msg)` → `{ error: msg }`; `('2026-02-30',…)` and `('24/11/2026',…)` → `Enter a valid date.`
  - `normalizeMicrochip(' 985112345678901 ')` → trimmed; `'985-112'`, `'x'.repeat(51)`, `''` → microchip error.
  - `normalizePetName('  Mochi ')` → `'Mochi'`; `'   '` → name error. `normalizeOptionalText(' Shiba ', 100, msg)` → `'Shiba'`; `'x'.repeat(101)` → `{ error: msg }`.
  - Existing `profile-rules.spec.ts` stays green after the `RuleError` move.
- [ ] **Step 2: Run** `pnpm --filter api exec vitest run src/pets src/common/time`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement.** Rounding: `Math.round(value * factor * 1000) / 1000` (factor 1 or 0.45359237), then range check. Date validity: parse `YYYY-MM-DD` with a regex, build `Date.UTC`, and confirm the same year/month/day come back. `localDate` uses `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })`.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `PF-02: Add pet field rules`.

### Task 3: `POST /v1/pets` with retry safety

**Files:**
- Create: `apps/api/src/common/idempotency/idempotency.service.ts`, `idempotency.module.ts`
- Modify: `apps/api/src/common/errors/error-codes.ts` (add `IDEMPOTENCY_KEY_REUSED`)
- Create: `apps/api/src/pets/pets.module.ts`, `pets.controller.ts`, `pets.service.ts`, `dto/create-pet.dto.ts`, `dto/pet-response.dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/pets.e2e-spec.ts` (create it; use `createApp('dev')`, run-unique owner names, clean up audit/outbox/idempotency/pets/owners in `afterAll`)

**Interfaces:**
- Consumes: Task 2 rules, `validationFailed`, `AppException`, `CurrentOwner`.
- Produces:
  - `IdempotencyService.execute(input: { ownerId: string; operation: string; key: string; payload: unknown }, create: (tx: Prisma.TransactionClient) => Promise<string>): Promise<string>`: returns the resource ID, new or replayed. Hash = SHA-256 hex of `JSON.stringify` with keys sorted recursively. Flow: in one `$transaction`, delete this owner/operation/key's row if `expiresAt <= now`; find the live row → same hash returns `resultReference`, different hash throws 409 `IDEMPOTENCY_KEY_REUSED` "This request key was already used for a different request." (details null); otherwise insert `IN_PROGRESS` (expires now + 24 h), call `create(tx)`, set `COMPLETED` + `resultReference`. On Prisma `P2002` from a concurrent insert, re-read the row once outside the transaction and apply the same hash rule.
  - `CreatePetDto { name: string; species: Species; speciesOther?: string; breed?: string; sex?: Sex; birthDate?: string; birthDateEstimated?: boolean; weight?: { value: number; unit: 'KG' | 'LB' }; weightMeasuredOn?: string; microchip?: string }`. Nested `WeightInputDto` with `@ValidateNested() @Type()`, `value` `@IsNumber()`, `unit` `@IsIn`.
  - `PetResponseDto.from(pet: Pet): PetResponseDto` with `{ id, name, species, speciesOther, breed, sex, birthDate, birthDateEstimated, currentWeightKg: number | null, weightMeasuredOn, microchip, version, createdAt }`; dates `YYYY-MM-DD`, `createdAt` ISO.
  - `PetsService.create(ownerId: string, key: string, dto: CreatePetDto): Promise<PetResponseDto>`; `POST /v1/pets` → 201.
  - The service normalises the DTO with the Task 2 rules (collecting all field errors, plus: `speciesOther` required when `OTHER` and rejected otherwise with `Only add a description when the species is Other.`; `birthDateEstimated: true` without `birthDate` → `Add a birth date to mark it as estimated.`; `weightMeasuredOn` without `weight` → `Add a weight for this measurement date.`; measured-on defaults to today), and passes the **normalised** values as the idempotency payload. Header `idempotency-key` must match `^[\x21-\x7E]{1,100}$`, else 400 with `details.fields['Idempotency-Key']` `Send an Idempotency-Key header of 1–100 visible characters.`
  - Inside `create(tx)`: insert pet, audit `{ action: 'pet.created', objectType: 'pet', objectId: petId, changeMetadata: { fields: [<names of provided fields>] } }`, outbox `{ eventType: 'pet.created', aggregateType: 'pet', aggregateId: petId, aggregateVersion: 1, payload: { petId } }`.

- [ ] **Step 1: Failing tests** in `pets.e2e-spec.ts`:
  - `{ name: 'Mochi', species: 'CAT' }` → 201, body equals `{ id, name: 'Mochi', species: 'CAT', speciesOther: null, breed: null, sex: 'UNKNOWN', birthDate: null, birthDateEstimated: false, currentWeightKg: null, weightMeasuredOn: null, microchip: null, version: 1, createdAt }`.
  - Full body with `weight: { value: 22, unit: 'LB' }` and no `weightMeasuredOn` → `currentWeightKg: 9.979`, `weightMeasuredOn` = the owner's local today.
  - `OTHER` without `speciesOther` → 400 on `speciesOther`; `DOG` with `speciesOther` → 400 on `speciesOther`; `OTHER` + `'Tortoise'` → 201.
  - Future `birthDate`, `weight: { value: 0, unit: 'KG' }` and `birthDateEstimated: true` without a date, in one request → 400 with exactly `birthDate`, `weight`, `birthDateEstimated` in `details.fields`.
  - Missing header → 400 on `Idempotency-Key`; no `X-Dev-Owner` → 401.
  - Same key and body twice → both 201 with the same `id`; `pets` count for the owner is 1.
  - Same key, body re-ordered with `'  Mochi '` → same `id`.
  - Same key, different `name` → 409 `IDEMPOTENCY_KEY_REUSED`.
  - Five simultaneous requests, same key and body → all 201, one distinct `id`, one pet.
  - Expired key: after a create, set its `idempotency_requests.expires_at` to the past; the same key and a new body → 201 with a new `id`.
  - Two pets named `Mochi` with different keys → both 201.
  - Audit and outbox: exactly one of each per pet; their JSON contains neither the pet name nor the microchip.
- [ ] **Step 2: Run** `pnpm --filter api exec vitest run --config ./vitest.config.e2e.ts test/pets`. Expected: FAIL, 404 (no route).
- [ ] **Step 3: Implement** the files above and register `PetsModule` and `IdempotencyModule` in `AppModule`.
- [ ] **Step 4: Run** the same command. Expected: PASS. Run the simultaneous test 5 times; it passes every time.
- [ ] **Step 5: Commit** `PF-02: Add POST /v1/pets with idempotent retries`.

### Task 4: List and read pets, cross-owner isolation

**Files:**
- Create: `apps/api/src/pets/dto/list-pets-query.dto.ts`
- Modify: `apps/api/src/pets/pets.service.ts`, `pets.controller.ts`
- Test: `apps/api/test/pets.e2e-spec.ts`

**Interfaces:**
- Produces: `ListPetsQueryDto { limit?: number /* @Type(() => Number) @IsInt @Min(1) @Max(100), default 20 */; cursor?: string /* @IsUUID() */ }`; `PetsService.list(ownerId, query): Promise<{ data: PetResponseDto[]; nextCursor: string | null }>` (where `ownerId`, `archivedAt: null`, `id > cursor`; `orderBy id asc`; take `limit + 1`); `PetsService.get(ownerId, id): Promise<PetResponseDto>` (`findFirst` by `id` and `ownerId`; a non-UUID `id` is answered as not found without querying); routes `GET /v1/pets`, `GET /v1/pets/:id`.

- [ ] **Step 1: Failing tests:**
  - 25 pets → first page 20 with `nextCursor` = the 20th `id`; second page 5 with `nextCursor: null`; together the 25 IDs in creation order. `?limit=5` → 5.
  - `?limit=0`, `?limit=101`, `?limit=abc` → 400 on `limit`; `?cursor=nope` → 400 on `cursor`.
  - An archived pet (set `archivedAt` in the database) is missing from the list but `GET /v1/pets/:id` still returns it.
  - `GET /v1/pets/:id` for an own pet → 200 with the same body as at creation.
  - Cross-owner: owner B's `GET /v1/pets/<A's pet>` body `toEqual` owner B's `GET /v1/pets/<randomUUID()>` body, both `{ statusCode: 404, code: 'NOT_FOUND', message: 'Not found', details: null }`; `GET /v1/pets/not-a-uuid` gives the same body; owner B's list contains none of owner A's IDs.
- [ ] **Step 2: Run** the pets e2e. Expected: the new tests FAIL (404 on the list route; detail route missing).
- [ ] **Step 3: Implement** the DTO, `list`, `get` and the routes.
- [ ] **Step 4: Run** the pets e2e. Expected: PASS.
- [ ] **Step 5: Commit** `PF-02: List and read pets with owner isolation`.

### Task 5: Docs, backlog and full verification

**Files:** `docs/backlog.csv`, `README.md`, `CLAUDE.md`, `docs/spec/epics/FN.md`, `apps/api/AGENTS.md`, the design doc

- [ ] **Step 1: Update.**
  - Backlog: PF-02 → `In Review`; add `PF-02-APP,Pet registration screens on the API,Task,PF,High,Proposed,PF-02,docs/spec/epics/PF.md` after it.
  - README: `curl` example of `POST /v1/pets` with `X-Dev-Owner` and `Idempotency-Key`.
  - CLAUDE.md guardrail: "converts units/doses" becomes "converts doses or clinical units (body-weight kg/lb display is allowed; decision 23 Nov 2026)".
  - FN.md FN-01 note: the first cross-owner tests landed with PF-02 (`test/pets.e2e-spec.ts`).
  - AGENTS.md: every create takes `Idempotency-Key` through `IdempotencyService.execute`; list endpoints return `{ data, nextCursor }` with ID-ordered cursors.
  - Design doc status → `approved 23 Nov 2026, implemented on PF-02-register-pet`.
- [ ] **Step 2: Verify:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e`, plus the drift check. Expected: all pass, `No difference detected`.
- [ ] **Step 3: Commit** `PF-02: Document the pet registration API`.
