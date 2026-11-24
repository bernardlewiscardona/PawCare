# LOCAL-01 — Local-first foundation

Date: 24 Nov 2026 · Status: approved 24 Nov 2026, implemented on LOCAL-01-local-first · Ticket: LOCAL-01 (new) · Spec: `docs/spec/00-overview.md`,
`docs/spec/epics/PF.md` (PF-01, PF-02)

## Intent

Release 1 keeps every owner's data on their own phone. There is no server holding pet or health
data and nothing to host. The reasons are **privacy** (health records never leave the device) and
**cost** (no hosting while the user base is small). Moving to a new phone uses an encrypted export
file (a separate design, LOCAL-02). When PawCare grows, a server comes back: the owner signs in
(AUTH-01) and their phone data uploads into their account.

This ticket lays the foundation the remaining stories build on: an encrypted SQLite database on
the phone, a shared rules package, a change history, and the owner profile and pets (PF-01,
PF-02) moved onto it. The NestJS API and PostgreSQL are parked as the future server.

**Who builds what.** We build the on-phone data layer and its typed contract. A co-developer
builds the screens against that contract, in place of Swagger. Their work stays tracked as
`<ID>-APP` subtasks.

## Goals

1. An encrypted on-phone database (`expo-sqlite` with SQLCipher) that opens reliably, migrates
   forward, and refuses to run unencrypted outside development.
2. A typed data contract (`apps/mobile/src/data`) for the owner profile and pets, with the same
   rules, error codes and conflict behaviour the API has today.
3. A data model that uploads to the server later as a copy, not a conversion: same ERD tables
   and columns, UUIDv7 IDs created on the phone, `owner_id` on every owned row, `version` on
   every editable row.
4. One copy of the rules (`packages/core`), used by the phone now and the API later.
5. A change history on the phone (`change_log`) that records every mutation, with field names
   only.

## Non-goals

- Export and import (LOCAL-02). Pet editing and `archivedAt` (PF-03, next).
- The sign-in upload and any sync (with AUTH-01, when the server returns).
- Tables for later stories: each story adds its own tables by migration (medical records, vaccines,
  reminders, inventory…).
- Screens. The co-developer moves the profile and pet screens off the demo store in
  `PF-01-APP` / `PF-02-APP`.
- Keeping the PostgreSQL schema in step with SQLite. It catches up when the server returns.

## Anti-goals

- A test or release build that stores data unencrypted, including silently (SQLCipher missing from
  the binary does not make `PRAGMA key` fail).
- Pet names, health text, phone numbers or other values in `change_log`.
- Any network request carrying owner or pet data.
- Two copies of a rule that can drift (the phone and the API judging a name or weight
  differently).
- Deleting an owner's database file automatically, for any reason.

## Constraints

- **Spec and decisions.** This reverses the spec's working assumption "requires connectivity" and
  the 23 Nov 2026 decision "not an offline app". Data export moves from deferred to in scope, for
  moving phones only. Record it as a decision (below) before the work merges. The spec text from
  Notion stays as it is, with a note pointing to the decision.
- **PF-01 and PF-02 rules carry over unchanged**: display name 1–100 trimmed code points;
  IANA zone or `UTC`; optional phone in E.164 with country code; `weightUnit` KG/LB; pet name
  1–100; species list with `OTHER` needing a description; breed 1–100; microchip 1–50 letters or
  digits; birth and measurement dates real, from 1900 on and not after the owner's today; weight
  >0 and ≤1,000 kg in 1 g steps, lb converted at 0.45359237; profile setup required before
  adding a pet (`PROFILE_SETUP_REQUIRED`). Error messages are copied verbatim from the API.
- **Shared requirements that still apply on the phone**: field-level validation errors (2),
  version conflicts and paginated, ID-ordered lists (3), date-only facts stored as dates (4),
  encryption at rest and no sensitive values in logs (6).
- **Expo SDK 58 facts** (checked 24 Nov 2026 against the v58 `expo-sqlite` docs):
  - SQLCipher is enabled with the config plugin option `useSQLCipher: true` and needs a
    development or release build. It doesn't work in Expo Go.
  - `PRAGMA key` doesn't fail when SQLCipher is missing, but `PRAGMA cipher_version` returns no
    row in that case.
  - `withExclusiveTransactionAsync` runs on a second connection without `PRAGMA foreign_keys`.
  - `withTransactionAsync` lets any concurrent query join the open transaction.
- **Mobile conventions** (`apps/mobile/AGENTS.md`, CLAUDE.md): add packages with
  `pnpm --filter mobile exec expo install`; Vitest for plain logic; `@/` maps to `src/`.

## Approaches considered

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| **A. Shared rules package + on-phone SQLite** | One new workspace package; PF-01/PF-02 rules move out of `apps/api`. Rules written once, ERD shape kept for upload, typed contract for the co-developer | **Chosen by the user, 24 Nov 2026** |
| B. A fake `/v1` API answered inside the app | Screens switch to a URL later, but HTTP, headers and idempotency are emulated for no gain, and the sign-in upload is a different flow anyway | Rejected |
| C. Persist the demo store as one encrypted JSON file | Quickest, but no constraints or transactions (can't hold the stock ledger or reminder uniqueness), not ERD-shaped, and CLAUDE.md rules it out | Rejected |

## Design (decided)

### Decision record and docs

- `docs/decisions.md`: new row **Release 1 is local-first**. Confirmed 24 Nov 2026 by the user,
  for privacy and cost. Data stays on the phone, encrypted; moving phones uses an encrypted export
  file; a server and sign-in come later, and the phone data uploads into the owner's account;
  the API and PostgreSQL are parked. It affects every ticket. Add a decision-log entry. Mark the
  23 Nov "not an offline app" line as superseded rather than editing it.
- `docs/spec/00-overview.md`: a short note at the top of "Working assumptions" naming the
  decision and the assumptions it replaces (connectivity, export deferred, authentication as a
  prerequisite). The Notion text itself is unchanged.
- `CLAUDE.md`:
  - Release 1 is local-first.
  - "Our stories are backend only" becomes "our stories deliver the on-phone data layer and its
    contract; the co-developer builds the screens (`<ID>-APP`)".
  - The data contract replaces Swagger.
  - The API and PostgreSQL are parked: kept building and tested in CI, not deployed, and not
    changed by feature stories.
  - Remove "Don't grow the store into a persistence or offline layer"; the demo store is
    replaced slice by slice by `src/data`.
  - "Later tickets" adds: AUTH-01 brings the sign-in upload.
  - Data model rules apply to the SQLite schema, with the differences listed below.
- `apps/mobile/AGENTS.md`: a "Data layer (LOCAL-01)" section with the rules below.
- `docs/backlog.csv`:
  - Add `LOCAL-01` (this) and `LOCAL-02` (export and import, depends on LOCAL-01).
  - PF-01 and PF-02 go back to `In Progress`. Their API work is parked, and they are delivered on
    the phone in LOCAL-01, so both now depend on it.
  - Make PF-01-APP and PF-02-APP depend on LOCAL-01.
  - AUTH-01's title gains "and upload phone data".
- `docs/design/erd-and-flows.md` "Implementation status": the PostgreSQL schema is the parked
  server; the phone schema in `apps/mobile/src/data/migrations` is the live one.
- README: how the phone database works, and why encryption needs a development build.

### `packages/core` (`@pawcare/core`)

A new pnpm workspace (`pnpm-workspace.yaml` gains `packages/*`). Plain TypeScript, ESM, no React
Native or Node APIs. Unit-tested with Vitest. Its contents move from `apps/api` (with their
specs):

- `ErrorCode` (the API's `error-codes.ts` re-exports it, so no code is renamed), `RuleError` and
  `isRuleError`, `FieldErrors`.
- `localDate(timeZone, now?)`.
- Profile rules: `normalizeDisplayName`, `checkTimeZone`, `normalizePhone`. `libphonenumber-js`
  moves into core.
- Pet rules: `normalizePetName`, `normalizeOptionalText`, `normalizeMicrochip`,
  `checkPastOrToday`, plus `toGrams(value, unit): number | RuleError`, which replaces
  `toKilograms`. It returns whole grams; the API's stored kg is `grams / 1000`, so the API's
  results are unchanged.
- `uuidv7(randomBytes: (n: number) => Uint8Array, nowMs?: number): string` (RFC 9562 layout). The
  caller supplies randomness: `expo-crypto` on the phone, `node:crypto` in tests.

The API switches to importing these from core. Its unit and e2e tests must stay green unchanged;
that is the proof the move changed nothing.

Packaging: Metro and the mobile Vitest consume core's TypeScript source; the API consumes compiled
ESM (`dist`) through a package `exports` condition. Root `build` builds core before the API; CI
does the same.

### The phone database (`apps/mobile/src/data`)

**Database adapter interface.** All data code talks to a small interface:
`exec`, `run` (returns `changes`), `get`, `all`. Bound parameters only, never string-built SQL
with values. There are two adapters:

- `expo-sqlite` (the app).
- `node:sqlite` (Vitest). Node 22.18+ ships it, so migrations, constraints and repositories are
  tested against real SQLite in CI. SQLCipher itself is checked on a device (see Tests).

**One connection, one queue.** Every read and write runs through a single in-app queue on one
connection. A write is `BEGIN IMMEDIATE … COMMIT`, with `ROLLBACK` on error, inside the queue.
This keeps `PRAGMA foreign_keys = ON` in force and stops an unrelated query joining an open
transaction. The data is small, so serialising reads costs nothing noticeable.

**Opening.** `openPawCareData()` returns one of these states, and the co-developer shows a screen
for each that isn't `ready`:

| State | When |
| --- | --- |
| `ready` (`encrypted: true`) | Key loaded or created, `PRAGMA cipher_version` returned a row, migrations applied |
| `ready` (`encrypted: false`, dev only) | Running in Expo Go (`Constants.executionEnvironment === 'storeClient'`) and `__DEV__`. The app must show a visible "Development data, not encrypted" banner |
| `encryption-unavailable` | Any other build where `cipher_version` returns nothing. The app refuses to open the database |
| `key-missing` | A database file exists but no key is in secure storage (e.g. restored from a backup onto a new phone). **Start fresh** is offered |
| `too-new` | `user_version` is higher than the app's last migration (an older app version installed over a newer one). The app asks the owner to update; Start fresh is **not** offered |
| `failed` | Anything else: wrong or invalidated key, migration error, corrupt file. Details are logged without values. **Start fresh** is offered |

**Start fresh** (`startFresh()` on the `key-missing` and `failed` states):
- It renames the database file to `pawcare-<timestamp>.retired.db` and moves its key, if one
  exists, to a secure-store entry named after that file.
- It then creates a new key and database. It never deletes or overwrites a file or key, so a
  retired database stays readable. Retired files aren't shown in release 1 and are never cleaned
  up automatically; LOCAL-02 may offer recovery from them.
- A failed migration rolls back its own transaction, so the file stays at its last good version.

**Key handling.**
- On first launch, 32 random bytes (`expo-crypto`) become the key, stored with
  `expo-secure-store` as `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- The key is applied with `PRAGMA key` right after opening, before any other statement.
- Android `allowBackup: false` in `app.json`, so OS backups don't produce unreadable copies.
  LOCAL-02's export is the supported way to move.

**Migrations.**
- An ordered list in `src/data/migrations/NNNN-<name>.ts`, each one SQL script. Each runs in its
  own transaction, followed by `PRAGMA user_version = N`. The order is append-only and released
  migrations are never edited.
- A test applies every migration to an empty database and checks `user_version`.

**Schema for LOCAL-01 (migration `0001-owner-and-pets`).** Columns follow the ERD and the Prisma
schema, minus server-only fields. The SQLite differences, which apply to every future table:

| ERD / PostgreSQL | SQLite on the phone |
| --- | --- |
| `uuidv7()` default | `TEXT` UUIDv7 created by the app via `uuidv7()`; `CHECK (length(id) = 36)` |
| `timestamptz` | `TEXT` ISO-8601 UTC with milliseconds (`2026-11-24T08:15:00.000Z`) |
| `date` | `TEXT` `YYYY-MM-DD` with `CHECK (date(x) = x)` |
| `decimal(7,3)` kg | `INTEGER` grams (`current_weight_g`), `CHECK (> 0 AND <= 1000000)` |
| enums | `TEXT` with `CHECK (x IN (…))` |
| `boolean` | `INTEGER` 0/1 with `CHECK` |

- `owners`:
  - Columns: `id`, `display_name` (NULL only while `profile_completed_at` is NULL), `phone`,
    `time_zone` (placeholder `UTC`), `weight_unit` (default `KG`), `profile_completed_at`,
    `created_at`, `updated_at`, `version`.
  - Not carried over: `auth_subject` and `account_status`, which are server identity; the upload
    adds them.
  - `CREATE UNIQUE INDEX owners_single ON owners ((1))`: exactly one owner per phone.
  - The owner row is created on the first `ready` open.
- `pets`: the Prisma `Pet` columns with the conversions above, and the same CHECKs as the
  PostgreSQL baseline (name, species/species_other, breed ≤100, microchip ≤50, weight range,
  estimated needs a birth date, measurement date needs a weight). It also has `UNIQUE (owner_id,
  id)` and `FOREIGN KEY (owner_id) REFERENCES owners (id)`, keeping the same-owner composite-FK
  pattern for child tables. `photo_asset_id` waits for MR-02.
- `change_log`: `id`, `owner_id`, `entity_type`, `entity_id`, `entity_version`, `action`
  (`pet.created`, `owner.profile_updated`…), `fields` (JSON array of field names), `occurred_at`.
  It is append-only: triggers reject `UPDATE` and `DELETE`. It replaces both `audit_events` and
  `outbox_events` on the phone. Each mutation writes its row in the same transaction.

### The data contract (what the co-developer calls)

`apps/mobile/src/data/index.ts` exports:

- `DataProvider` (opens the database once and exposes the open state) and `useData()`, which
  returns `{ owner, pets }`.
- `useLiveQuery(read, deps)`: runs `read()` and runs it again after any committed write that
  touched a table it declared.
- `DataError`: `{ code, message, details }`, the same codes and `details` shapes as the API
  (`VALIDATION_FAILED` with `details.fields`, `NOT_FOUND`, `CONFLICT` with `details.current`,
  `PROFILE_SETUP_REQUIRED`).

Repositories:

| Call | Behaviour (same as the API endpoint it replaces) |
| --- | --- |
| `owner.get(): Promise<OwnerProfile>` | `GET /v1/me` fields that exist on the phone: `id`, `displayName`, `phone`, `timeZone`, `weightUnit`, `profileSetupRequired`, `version` |
| `owner.update(input: { version } & Partial<…>)` | `PATCH /v1/me`: first save needs `displayName` and `timeZone`; stale `version` → `CONFLICT` with current; no-op returns current without a version bump |
| `pets.create(input: CreatePetInput)` | `POST /v1/pets` minus the `Idempotency-Key`. All field errors in one `VALIDATION_FAILED`; `PROFILE_SETUP_REQUIRED` before setup |
| `pets.list({ limit?, cursor? })` | `{ data, nextCursor }`, active pets, ID order, limit 1–100 (default 20) |
| `pets.get(id)` | One pet, archived or not; unknown or malformed ID → `NOT_FOUND` |

`Pet` keeps the API response shape, including `currentWeightKg` (grams ÷ 1000), so the
co-developer's types don't change when a server returns.

**Type and shape checks.** Inputs with wrong types or unknown fields are `VALIDATION_FAILED`
under the same field keys the API uses, including every weight error under `weight`. Only the
lists and limits are shared:
- Core exports the constants `SPECIES`, `SEXES`, `WEIGHT_UNITS`, `PAGE_LIMIT` (`{ min: 1, max:
  100, default: 20 }`), and the API's DTOs import them, which is the API's only change beyond
  imports.
- The phone has its own small shape checker in `src/data`, built on those constants.
- Its messages are plain sentences (`Choose a species.`, `This field isn't allowed.`), not
  class-validator's default wording. The app reads the field keys and codes; no message text is
  part of the contract except the rule messages copied from the API.

**Wiring into the app (in this ticket).** The device checks need a running database, so LOCAL-01
does a minimal amount of app work:
- It mounts `DataProvider` in `src/app/_layout.tsx`. The splash stays up until the open state is
  known.
- It renders a plain full-screen message for each state that isn't `ready`, with a Start fresh
  button where offered, and the dev banner, all built from the existing UI kit.
- It adds an open-state readout (state, `encrypted`, `user_version`) to the Developer tools screen
  (`src/app/dev.tsx`).

The co-developer restyles those screens in PF-01-APP. Screens still read the demo store until
their `-APP` subtask moves them.

**No idempotency keys on the phone.** A local write either commits or throws; there is no
in-flight network request to retry. Screens still disable double submit. When the server returns,
the upload is idempotent by row ID.

### The parked API

`apps/api`, PostgreSQL, `compose.yaml` and the API's CI steps stay. The API is changed only to
import the rules from core. Feature stories don't touch it. No deployment.

## Tests (written first)

- **core** (moved specs plus new ones):
  - `uuidv7` gives version 7 and the RFC variant bits, keeps time order across milliseconds, and
    embeds the given `nowMs`.
  - `toGrams(22,'LB')` → `9979`; `(0.001,'LB')` → error; `(9.5,'KG')` → `9500`;
    `(1000.001,'KG')` → error; `(1000,'KG')` → `1000000`.
- **Migrations** (`node:sqlite`): each one applies to an empty database. Each CHECK rejects a bad
  row: a second owner, a pet with an unknown owner, `species_other` with `DOG`, 0 g, `2026-02-30`
  as a date, and a display name NULL after setup. `change_log` rejects UPDATE and DELETE.
- **Repositories** (`node:sqlite`), one test per API e2e case that applies on the phone:
  - Create with only name and species → every optional field `null`, `sex` `UNKNOWN`. Full create
    with `22 LB` → `currentWeightKg` 9.979.
  - `OTHER` rules; a future date, zero weight and estimated-without-date together → three field
    errors at once.
  - `PROFILE_SETUP_REQUIRED` before setup, and nothing stored.
  - Owner first save needs name and zone; a stale version → `CONFLICT` with current; two updates
    with the same version → one succeeds, one `CONFLICT`.
  - Lists: 25 pets → 20 + 5, archived excluded; `limit` 0, 101 and `'abc'` and a bad cursor →
    `VALIDATION_FAILED`.
  - Each mutation writes exactly one `change_log` row, and the serialised log contains no pet
    name, microchip or phone.
  - A failed write leaves no pet and no log row.
- **Opening** (adapter faked): an Expo Go dev build → `encrypted: false`; another build with no
  `cipher_version` → `encryption-unavailable`; file present, key absent → `key-missing`;
  **Start fresh** renames the file and never deletes it.
- **API**: existing unit and e2e suites pass unchanged after the move to core.
- **On a device** (a manual check, recorded in the PR). Run on an Android **development build**
  (`expo run:android`, debuggable, so `run-as` works), not the release test APK:
  - The Developer tools readout shows `encrypted: true`.
  - The database file pulled with `adb exec-out run-as com.pawcare.app …` doesn't open in plain
    `sqlite3`.
  - An Expo Go run shows the banner.

## Effects on later stories (recorded now, designed in each story)

- **RM-01–RM-04**: reminders are scheduled as local notifications on the phone. There are no push
  tokens or delivery workers. Source eligibility is re-checked when a notification opens.
- **MR-02 and photos**: files live in the app's private storage, encrypted. Server-side malware
  scanning and expiring links don't apply locally.
- **FN-01**: one owner per phone, so isolation holds by construction. `owner_id` stays for the
  upload.
- **FN-02**: "delete my data" wipes the database, its key and the files on this phone.
- **AUTH-01**: sign-in plus the upload of phone data into the account.
- **Idempotency and the outbox** come back with the server. On the phone, `change_log` covers
  both.

## Calls made while writing this up

- **Branch:** `LOCAL-01-local-first`, from `main` after the PF-02 PR merges (otherwise from
  `PF-02-register-pet`, rebased after the merge).
- **Plain SQL with hand-written migrations, not Drizzle.** This matches the project's
  hand-written CHECKs and triggers, avoids the Babel `.sql` setup, and lets the same SQL run under
  `node:sqlite` in tests.
- **One queue for reads and writes**, rather than a read connection plus a write connection.
  It's simpler and avoids the `withTransactionAsync` join problem.
- **Tables are added per story**, not the whole ERD now.
- **Weight is stored in grams on the phone.** The contract still speaks kg, so nothing changes for
  the screens or the upload.
- **No device backups** (Android `allowBackup: false`, device-only key on iOS). Export is the way
  to move phones.
- **Expo Go dev exception** (approved by the user, 24 Nov 2026): unencrypted only in Expo Go
  with `__DEV__`, and a visible banner.
- **Android now, iPhone later** (approved by the user, 24 Nov 2026):
  - The code is platform-neutral, but the device checks run on Android only.
  - A linked task `LOCAL-01-IOS` (in `docs/backlog.csv`, depends on LOCAL-01) covers an iOS
    build and the same checks once a Mac or an Apple developer account is available.
  - On iOS the encrypted database may go into iCloud backups. The key is device-only, so the
    backup is unreadable, and a restore lands on `key-missing` and Start fresh.
- **After the builder check:**
  - Start fresh keeps the old file and its key side by side, and a newer database gives
    `too-new`.
  - LOCAL-01 wires the provider and plain state screens into the app.
  - Only the lists and limits are shared for type checks; type-error wording isn't part of the
    contract.

## Left to the builder

- Exact file layout inside `src/data`, the queue implementation, the shape of the `useLiveQuery`
  table declarations, the `packages/core` build and `exports` setup.
- Confirming Hermes on both platforms supports `Intl.supportedValuesOf('timeZone')` and
  `Intl.DateTimeFormat` with `timeZone`. If not, ship a zone list in core and record that in
  AGENTS.md.
