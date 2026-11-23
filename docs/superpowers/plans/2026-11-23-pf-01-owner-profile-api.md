# PF-01 Owner Profile API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner save their display name, phone and time zone through `PATCH /v1/me`, and tell the app whether profile setup is still needed.

**Architecture:** A migration adds `owners.profile_completed_at`. `OwnersService.updateProfile` validates with small pure rule functions, applies a version-checked update, and writes audit and outbox rows in one Prisma transaction. Validation errors gain a field-level `details.fields` map for every endpoint through the `ValidationPipe` exception factory.

**Tech Stack:** NestJS 12 (ESM), Prisma 7 + PostgreSQL 16, class-validator, `libphonenumber-js`, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-11-23-pf-01-owner-profile-api-design.md` (read it with this plan).

## Global Constraints

- Backend only. Don't touch `apps/mobile`.
- Relative imports end in `.js`. Mocks use `vi.fn()`. Config only via `ConfigService<Env, true>`.
- Error body is always `{ statusCode, code, message, details }`. Reuse `VALIDATION_FAILED` (400), `CONFLICT` (409), `UNAUTHORIZED` (401); add no codes.
- Existing `GET /v1/me` fields and the existing `details.errors` list are unchanged; only additions.
- Owner comes from `@CurrentOwner()` only (`apps/api/AGENTS.md`).
- No names, phone numbers or time-zone values in logs, `audit_events.change_metadata` or `outbox_events.payload`; field names only.
- Display name: trimmed, 1–100 Unicode code points. Time zone: in `Intl.supportedValuesOf('timeZone')` or exactly `UTC`. Phone: must start with `+`; stored as E.164; `null` clears it.
- Local commands need: `export PATH=/home/bernard/.nvm/versions/node/v22.23.5/bin:$PATH DATABASE_URL='postgresql://pawcare:pawcare_local@localhost:5432/pawcare?schema=public'` and the database up (`pnpm db:up`).
- Commits: `PF-01: <imperative summary>`, repository git identity, no Claude trailers.

## Review Focus

1. Phone typed with punctuation (`+63 (917) 123-4567`) is accepted and normalised to `+639171234567`, not rejected. → Task 2 test.
2. Display name with tabs/newlines around it (`"\tBea\n"`) is stored as `Bea`. → Task 2 test.
3. A JSON string version (`"version": "1"`) gets a 400 with `details.fields.version`, not a 500 or a silent coercion. → Task 4 test.
4. Wrong-case zone (`asia/manila`) is rejected with a field error (IANA names are case-sensitive). → Task 2 test.
5. An over-long phone (`+63` followed by 30 digits) gets a field error, not a database CHECK failure (500). → Task 2 test.

---

### Task 1: Field-level validation errors

**Files:**
- Create: `apps/api/src/common/errors/validation.ts`
- Create: `apps/api/src/common/errors/validation.spec.ts`
- Modify: `apps/api/src/app.setup.ts` (the `ValidationPipe` options)

**Interfaces:**
- Produces:
  - `type FieldErrors = Record<string, string[]>`
  - `validationFailed(fields: FieldErrors): AppException`: 400, code `VALIDATION_FAILED`, message `Request validation failed`, `details: { errors: string[], fields: FieldErrors }` where `errors` is every message flattened in field order.
  - `fieldErrorsFrom(errors: ValidationError[]): FieldErrors`: one entry per property (nested properties as `parent.child`), values are the constraint messages.

- [ ] **Step 1: Create the branch.** If `origin/main` contains `apps/api/src/auth/owner-auth.guard.ts` (FN-01 merged): `git switch main && git pull --ff-only && git switch -c PF-01-owner-profile`. Otherwise `git switch -c PF-01-owner-profile FN-01-owner-access` and rebase onto `main` after FN-01 merges.

- [ ] **Step 2: Write the failing tests** in `validation.spec.ts`:
  - `validationFailed({ phone: ['Include the country code'], timeZone: ['Unknown time zone'] })` → `getStatus()` 400, `code` `VALIDATION_FAILED`, `message` `Request validation failed`, `details` equals `{ errors: ['Include the country code', 'Unknown time zone'], fields: { phone: [...], timeZone: [...] } }`.
  - `fieldErrorsFrom` on a `ValidationError` for `version` with constraints `{ isInt: 'version must be an integer number' }` → `{ version: ['version must be an integer number'] }`; one with a child `address` → `city` → key `address.city`; a whitelist error (`property: 'authSubject'`, constraint `whitelistValidation`) → `{ authSubject: ['property authSubject should not exist'] }`.

- [ ] **Step 3: Run:** `pnpm --filter api exec vitest run src/common/errors`. Expected: FAIL, cannot find module `./validation.js`.

- [ ] **Step 4: Implement** both functions in `validation.ts`, and in `app.setup.ts` add `exceptionFactory: (errors) => validationFailed(fieldErrorsFrom(errors))` to the existing `ValidationPipe` options.

- [ ] **Step 5: Run** `pnpm --filter api exec vitest run src/common/errors` (PASS) and `pnpm test:e2e` (all existing e2e PASS: the health spec's 404 shape is unaffected).

- [ ] **Step 6: Commit** `PF-01: Add field-level validation error details`, including the still-uncommitted design and plan docs (`docs/superpowers/specs/2026-11-23-pf-01-owner-profile-api-design.md`, `docs/superpowers/plans/2026-11-23-pf-01-owner-profile-api.md`).

### Task 2: Profile field rules

**Files:**
- Modify: `apps/api/package.json` (dependency)
- Create: `apps/api/src/owners/profile-rules.ts`
- Create: `apps/api/src/owners/profile-rules.spec.ts`

**Interfaces:**
- Produces (each returns the stored value, or `{ error: string }`):
  - `normalizeDisplayName(value: string): string | { error: string }`
  - `checkTimeZone(value: string): string | { error: string }`
  - `normalizePhone(value: string | null): string | null | { error: string }`
- Error copy (used verbatim by Task 4 tests): display name `Enter a name of 1–100 characters.`; time zone `Choose a valid time zone.`; phone `Enter the number with its country code, like +63 917 123 4567.`

- [ ] **Step 1: Add the dependency:** `pnpm --filter api add libphonenumber-js@1.13.17` (already in the store; the lockfile must change only for `apps/api`).

- [ ] **Step 2: Write the failing tests** in `profile-rules.spec.ts`:
  - `normalizeDisplayName`: `'  Bea Santos '` → `'Bea Santos'`; `'\tBea\n'` → `'Bea'`; `'Bé Ánh 🐾'` unchanged; `'x'.repeat(100)` ok; `'🐾'.repeat(100)` ok (100 code points, 200 UTF-16 units); `'x'.repeat(101)`, `'   '`, `''` → `{ error: 'Enter a name of 1–100 characters.' }`.
  - `checkTimeZone`: `'Asia/Manila'`, `'Europe/London'`, `'UTC'` returned as-is; `'Mars/Base'`, `'GMT+8'`, `'asia/manila'`, `''` → `{ error: 'Choose a valid time zone.' }`.
  - `normalizePhone`: `'+63 917 123 4567'` and `'+63 (917) 123-4567'` → `'+639171234567'`; `'+44 20 7946 0958'` → `'+442079460958'`; `null` → `null`; `'09171234567'`, `'+63 123'`, `'+63' + '9'.repeat(30)`, `''` → `{ error: 'Enter the number with its country code, like +63 917 123 4567.' }`.

- [ ] **Step 3: Run:** `pnpm --filter api exec vitest run src/owners`. Expected: FAIL, cannot find module `./profile-rules.js`.

- [ ] **Step 4: Implement** in `profile-rules.ts`. Display name: `value.trim()`, length by `[...s].length`. Time zone: membership in a module-level `Set` built once from `Intl.supportedValuesOf('timeZone')`, plus `'UTC'`. Phone: require leading `+`; `parsePhoneNumberFromString` from `libphonenumber-js/min`, accept only when `isValid()`; return `.number` (E.164).

- [ ] **Step 5: Run** `pnpm --filter api exec vitest run src/owners`. Expected: PASS.

- [ ] **Step 6: Commit** `PF-01: Add owner profile field rules`.

### Task 3: `profile_completed_at` and `profileSetupRequired`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Owner`)
- Create: `apps/api/prisma/migrations/<timestamp>_owner_profile_completed_at/migration.sql` (generated)
- Modify: `apps/api/src/owners/dto/owner-response.dto.ts`
- Create: `apps/api/test/support/create-app.ts`
- Modify: `apps/api/test/owner-identity.e2e-spec.ts`
- Create: `apps/api/test/owner-profile.e2e-spec.ts`

**Interfaces:**
- Produces:
  - Prisma field `Owner.profileCompletedAt DateTime? @map("profile_completed_at") @db.Timestamptz(3)`.
  - `OwnerResponseDto.profileSetupRequired: boolean` (`profileCompletedAt === null`), with `@ApiProperty`.
  - `createApp(mode: AuthMode): Promise<INestApplication>` in `test/support/create-app.ts`: the helper now inside `owner-identity.e2e-spec.ts`, moved and imported from there.

- [ ] **Step 1: Write the failing test.** Move `createApp` to `test/support/create-app.ts`. In `owner-identity.e2e-spec.ts`, add `profileSetupRequired: true` to the "creates the owner on first use" `toEqual`. Create `owner-profile.e2e-spec.ts` (AUTH_MODE `dev`, owner names `e2e-<run>-<label>`, delete them in `afterAll`) with: `GET /v1/me` for a new owner → `profileSetupRequired: true`.

- [ ] **Step 2: Run** `pnpm test:e2e`. Expected: both new expectations FAIL (`profileSetupRequired` undefined); everything else PASS.

- [ ] **Step 3: Add the field to `schema.prisma`, then generate and apply:** `pnpm --filter api exec prisma migrate dev --name owner_profile_completed_at` (if it prompts, use `--create-only` and then `pnpm --filter api db:migrate:deploy`). Then check drift: `pnpm --filter api exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → `No difference detected`.

- [ ] **Step 4: Add `profileSetupRequired` to `OwnerResponseDto` and `from()`.**

- [ ] **Step 5: Run** `pnpm test:e2e`. Expected: PASS.

- [ ] **Step 6: Commit** `PF-01: Report whether owner profile setup is required`.

### Task 4: `PATCH /v1/me`

**Files:**
- Create: `apps/api/src/owners/dto/update-owner-profile.dto.ts`
- Modify: `apps/api/src/owners/owners.service.ts`
- Modify: `apps/api/src/owners/owners.controller.ts`
- Modify: `apps/api/test/owner-profile.e2e-spec.ts`

**Interfaces:**
- Consumes: `validationFailed` (Task 1); `normalizeDisplayName`, `checkTimeZone`, `normalizePhone` (Task 2); `OwnerResponseDto` and `createApp` (Task 3).
- Produces:
  - `UpdateOwnerProfileDto { version: number; displayName?: string; timeZone?: string; phone?: string | null }`. `@IsInt() @Min(1)` on version; `@IsOptional() @IsString()` on the others (null passes for `phone`); every field `@ApiProperty`/`@ApiPropertyOptional`.
  - `OwnersService.updateProfile(ownerId: string, dto: UpdateOwnerProfileDto): Promise<OwnerResponseDto>`
  - `PATCH /v1/me` → 200 `OwnerResponseDto`; `@ApiBadRequestResponse`, `@ApiConflictResponse`, `@ApiUnauthorizedResponse`.

**Order of checks in `updateProfile`** (all inside one `prisma.$transaction`):
1. Run the Task 2 rules on each present field; any errors → `validationFailed` with all of them.
2. Read the owner. If `profileCompletedAt` is null and `displayName` or `timeZone` is absent → `validationFailed` with `Required to finish setting up your profile.` on each missing one.
3. `changedFields` = present fields whose normalised value differs from the stored one (order: `displayName`, `phone`, `timeZone`).
4. If `changedFields` is empty and setup is complete: if `version` matches, return the current profile (no bump, no events); otherwise 409 (step 5's response).
5. `updateMany({ where: { id: ownerId, version }, data: { …changes, version: { increment: 1 }, profileCompletedAt: (setup required) ? new Date() : undefined } })`. Count 0 → throw `AppException(CONFLICT, 409, 'This profile was changed elsewhere. Review the latest version and try again.', { current: OwnerResponseDto })`.
6. Create `audit_events` (`actorOwnerId: ownerId`, `action: 'owner.profile_updated'`, `objectType: 'owner'`, `objectId: ownerId`, `changeMetadata: { fields: changedFields }`) and `outbox_events` (`eventType: 'owner.profile_updated'`, `aggregateType: 'owner'`, `aggregateId: ownerId`, `aggregateVersion`: new version, `payload: { changedFields, timeZoneChanged, setupCompleted }`).
7. Return the updated profile.

- [ ] **Step 1: Write the failing e2e tests** in `owner-profile.e2e-spec.ts` (`patch(owner, body)` helper sets `X-Dev-Owner`):
  - First save `{ version: 1, displayName: ' Bea Santos ', timeZone: 'Asia/Manila' }` → 200, body `{ id, displayName: 'Bea Santos', phone: null, timeZone: 'Asia/Manila', version: 2, profileSetupRequired: false }`; a following `GET` returns the same.
  - First save without `timeZone` → 400, `details.fields.timeZone` equals `['Required to finish setting up your profile.']`; a `GET` still shows `version: 1`, `profileSetupRequired: true`.
  - After setup, `{ version: 2, phone: '+63 917 123 4567' }` → 200, `phone: '+639171234567'`, `version: 3`; then `{ version: 3, phone: null }` → `phone: null`.
  - Invalid values `{ version: 1, displayName: '   ', timeZone: 'Mars/Base', phone: '0917' }` → 400 with exactly the keys `displayName`, `timeZone`, `phone` in `details.fields`, using Task 2's copy.
  - `{ version: '1', … }` → 400 with `details.fields.version`.
  - `{ version: 1, …, authSubject: 'dev:x' }` → 400 with `details.fields.authSubject`.
  - No header → 401 `Sign-in required`.
  - Stale: after a successful save to version 2, sending `version: 1` → 409, code `CONFLICT`, `details.current.version` 2; the profile is unchanged.
  - Two concurrent saves with `version: 2` and different names → statuses sorted equal `[200, 409]`.
  - `{ version: 2 }` alone after setup → 200, `version` still 2, no new audit row.
  - Events: after one successful save, exactly one `audit_events` row for `objectId` with `changeMetadata` `{ fields: ['displayName', 'timeZone'] }`, and one `outbox_events` row with `payload` `{ changedFields: ['displayName', 'timeZone'], timeZoneChanged: true, setupCompleted: true }`. `JSON.stringify` of both rows contains neither `Bea Santos` nor `Asia/Manila`. A failed (400 or 409) save adds no rows.
  - Isolation: owner B's save leaves owner A's `GET` unchanged.
  - `afterAll` deletes the run's `audit_events` (by `actorOwnerId`) and `outbox_events` (by `ownerId`) before the owners.

- [ ] **Step 2: Run** `pnpm --filter api exec vitest run --config ./vitest.config.e2e.ts test/owner-profile`. Expected: FAIL, `PATCH /v1/me` returns 404.

- [ ] **Step 3: Implement** the DTO, `updateProfile` (order above) and the controller route `@Patch() updateMe(@CurrentOwner() ownerId: string, @Body() dto: UpdateOwnerProfileDto)`.

- [ ] **Step 4: Run** the same command. Expected: PASS. Re-run the concurrency test five times (`-t 'concurrent'`); it must pass every time.

- [ ] **Step 5: Commit** `PF-01: Add PATCH /v1/me to save the owner profile`.

### Task 5: Docs, backlog and full verification

**Files:**
- Modify: `docs/backlog.csv`, `CLAUDE.md`, `README.md`, `apps/api/AGENTS.md`, `docs/superpowers/specs/2026-11-23-pf-01-owner-profile-api-design.md`

- [ ] **Step 1: Update docs.**
  - `backlog.csv`: PF-01 → `In Review`; add a row after it: `PF-01-APP,Owner profile screens on the API,Task,PF,High,Proposed,PF-01,docs/spec/epics/PF.md`.
  - `CLAUDE.md` "How to work on a story" step 3: our stories are API-only (API + data model); app screens and their loading/empty/error/retry states belong to the app developer, tracked as `<ID>-APP` subtasks.
  - `README.md` (owner section): an example `curl -X PATCH` with `X-Dev-Owner`, JSON body `{"version":1,"displayName":"Bea","timeZone":"Asia/Manila"}`.
  - `apps/api/AGENTS.md`: the `details.fields` shape and `validationFailed()`; the version pattern (update where `id`, `ownerId` and `version` match; else 409 with `details.current`); audit and outbox rows in the same transaction with field names only.
  - Design doc status → `approved 23 Nov 2026, implemented on PF-01-owner-profile`.

- [ ] **Step 2: Verify:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e`. Expected: all pass. Also run the drift check from Task 3 Step 3 → `No difference detected`.

- [ ] **Step 3: Commit** `PF-01: Document the owner profile API`.
