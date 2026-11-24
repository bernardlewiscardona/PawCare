# PawCare — project guide for Claude

PawCare is a **mobile pet diary for pet owners**: pet profiles, owner-entered health history, vaccines, prescriptions, an appointment diary, reminders, and household supplies. Release 1 is **owner-only** and **local-first**: owner and pet data live in an encrypted SQLite database on the phone, behind the typed contract in `apps/mobile/src/data`. The NestJS API and PostgreSQL are **parked** (still built and tested in CI, not deployed, and not changed by feature stories). The rules both sides share live in `packages/core` (`@pawcare/core`). Decision: `docs/decisions.md`, 24 Nov 2026.

The product spec is the source of truth. Read it before designing or coding anything:

- `docs/spec/00-overview.md` — scope, working assumptions, open decisions, **shared requirements**, delivery sequence, Definition of Ready/Done, deferred backlog
- `docs/spec/epics/<EPIC>.md` — stories with acceptance criteria (FN, PF, MR, VC, AP, RM, IN)
- `docs/backlog.csv` — 7 epics + 27 stories with priority, status, dependencies
- `docs/decisions.md` — open product decisions and release gates
- `docs/design/erd-and-flows.md` — proposed logical data model (Mermaid ERDs) and 8 app flowcharts
- `docs/design/erd-review.md` — known gaps/conflicts in that design; check before touching the affected tables

## Data model rules (from the ERD)

The whole ERD is implemented in PostgreSQL (`apps/api/prisma/schema.prisma` plus the baseline migration, the **parked** server schema; see "Implementation status" in `docs/design/erd-and-flows.md`). The **live** schema is SQLite on the phone: `apps/mobile/src/data/migrations` (append-only, `PRAGMA user_version`). Feature tickets add a phone migration for each change and keep the same ERD rules, with these SQLite conversions:

| ERD / PostgreSQL | SQLite on the phone |
| --- | --- |
| `uuidv7()` default | `TEXT` UUIDv7 created by the app; `CHECK (length(id) = 36)` |
| `timestamptz` | `TEXT` ISO-8601 UTC with milliseconds |
| `date` | `TEXT` `YYYY-MM-DD` with `CHECK (date(x) IS x)` (`= x` lets `2026-13-01` through: `date()` returns NULL and a NULL `CHECK` passes) |
| `decimal` kg | `INTEGER` grams |
| enums | `TEXT` with `CHECK (x IN (…))` |
| `boolean` | `INTEGER` 0/1 with `CHECK` |

The API's schema is not changed by feature stories. The phone schema is built so the data uploads later as a copy, not a conversion.

- IDs are UUIDv7 (generated in the database by `uuidv7()` on the server; created by the app on the phone). Every owner table has `owner_id`.
- `CARE_RECORDS` is the shared parent for MEDICAL / VACCINE / PRESCRIPTION / APPOINTMENT; exactly one matching subtype row, written in the same transaction. Appointments are never voided.
- Same-owner composite FKs everywhere (e.g. `CARE_RECORDS(owner_id, pet_id) → PETS(owner_id, id)`); an ID alone is never authorization.
- Derived, not stored: health timeline, Care Due, overdue status, Needs Update, physical/usable stock.
- Inventory is an immutable ledger (`STOCK_TRANSACTIONS` + `STOCK_ENTRIES`); batch balances are a locked transactional cache; reversals are compensating entries.
- Reminders: `REMINDER_SCHEDULES` with exactly one typed source FK + CHECK; versioned; occurrences are the inbox (no separate notifications table); push deliveries per device token.
- Every mutation commits its `OUTBOX_EVENTS` row atomically; idempotency via `IDEMPOTENCY_REQUESTS(owner_id, operation, request_key)`. On the phone, the append-only `change_log` (field names only, written in the same transaction) covers both audit and outbox, and idempotency returns with the server.
- Dose occurrences are generated over a rolling window; regeneration never erases logs or duplicates alerts.

Origin: Notion "PawCare_Backlog_Specifications" v1.1 (4 Nov 2026). If the spec and this file ever disagree, the spec wins — flag the conflict. The one exception is the 24 Nov 2026 local-first decision (`docs/decisions.md`), which supersedes the spec's connectivity and export assumptions.

## How to work on a story

1. Load the story (`/story <ID>`) and its dependencies. Check `docs/decisions.md` for anything blocking it.
2. Map every **Given/When/Then** to at least one automated test before implementing; also cover the story's "Edge Cases & Failure Points".
3. Implement the on-phone data layer: repositories, a migration and the change log in `apps/mobile/src/data`, with shared rules in `packages/core`. Our stories deliver that layer and its contract; app screens and their loading / empty / error / retry states belong to the app developer, tracked as a linked `<ID>-APP` subtask in `docs/backlog.csv`. The `src/data` contract (`index.ts`) is what they build against. The API is parked, so don't extend it.
4. Verify against the 8 shared requirements and the Definition of Done (`/spec-check <ID>`).
5. Update the story's `Status` in `docs/backlog.csv`.

Don't mark a story Done while an integration adapter it lists (e.g. a reminder source, a timeline source) is still missing — split it into a linked subtask instead.

## Product guardrails (never violate)

- **No clinical judgment.** PawCare never diagnoses, prescribes, calculates doses, infers vaccine intervals, or converts doses or clinical units (body-weight kg/lb display is allowed; decision 23 Nov 2026). Health records are labeled **Owner-entered**, never "verified".
- **Appointments are a diary, not bookings.** No clinic accounts, availability, reservations, confirmations, or messages. Use the exact copy from AP-01/AP-03/AP-04 (e.g. "Saved to your diary. Arrange or confirm this visit directly with your clinic").
- **Reminders never act on their own.** A reminder never marks care complete, logs a dose as taken, deducts stock, or infers appointment attendance. Cross-feature effects happen only through explicit user actions.
- **Archive/void, don't delete.** Everyday corrections use archive or void (with reason). Permanent deletion exists only in FN-02 account deletion.
- **Out of scope for v1:** shared caregivers, sync between devices, clinic integrations/EMR, data export (a phone-to-phone export/import file is the separate ticket LOCAL-02), payments, telehealth, dose calculators, complex recurrence (only fixed daily times), barcodes/purchasing, AI features. Don't build these "just in case".

## Engineering rules (shared requirements, condensed)

In release 1 these rules apply to the on-phone data layer (`apps/mobile/src/data`): validation runs in its repositories (server-side validation returns with the API), creates need no client request IDs because a local write either commits or throws (idempotency returns with the server and the upload), and "encrypt at rest" means SQLCipher.

- **Authorization:** sign-in is postponed until AUTH-01 (Google). On the phone there is one owner, and every repository still scopes by `owner_id`. In the parked API, the owner comes from `@CurrentOwner()`, resolved by the global guard from the dev-only `X-Dev-Owner` header (`AUTH_MODE=dev`); see `apps/api/AGENTS.md`. Check ownership server-side on every request, including nested resources and attachments. Inaccessible = generic not-found; leak nothing (names, counts, existence).
- **Idempotency:** creates and transactional actions accept a client request ID; retries create at most one record.
- **Concurrency:** every editable resource has a `version`; stale writes return a conflict with reload/review, never silent overwrite.
- **Collections:** stable IDs, deterministic sort with ID tiebreak, pagination default 20 / max 100.
- **Time:** event instants in UTC + IANA zone. Date-only facts (birth date, vaccine dates, due dates) stored as plain dates, no UTC conversion. Appointments use their own entered zone; owner-local reminders use owner zone. Reject nonexistent DST times; ask for offset on ambiguous ones.
- **Validation:** server-side with field-level errors; keep user input on error; show success only after server ack; disable double submit.
- **Privacy:** encrypt in transit and at rest; no health text, tokens, or attachment URLs in logs. Audit log = actor, timestamp, action, object ID (no health text). Lock-screen notifications are generic.
- **Archive semantics:** preserve history, hide from active selectors, cancel pending reminders; block archive while upcoming Planned appointments exist.
- **Accessibility:** screen-reader labels, scalable text, status not conveyed by color alone.
- **Files:** JPEG/PNG/PDF ≤10 MB, ≤5 per record, signature check + malware scan before linking, private storage, download links expire ≤5 min.
- **Reminders:** unique key `owner + source type/ID + schedule version + occurrence + channel`; re-check source eligibility at dispatch and on deep-link open.

## Delivery order

0. **SETUP-01** — repository, workspaces, local Postgres, API health endpoint, mobile placeholder, CI (`docs/spec/epics/SETUP.md`)
1. Foundation & diary — auth prerequisite, FN-01, PF-01–03, MR-01/02/04, VC-01/02, MR-03 (medical/vaccine/prescription sources)
2. Care tracking & reminders — RM-01/02 (source-neutral engine first), VC-03/04, RM-03/04
3. Appointment diary — AP-01–05, then timeline + reminder adapters
4. Inventory — IN-01–04 + inventory alerts
5. Release completion — PF-04 archive integration, FN-02 deletion across all resources, cross-account checks

Authentication (registration, sign-in, email verification, password recovery, sessions) is a **prerequisite** and not specified in this backlog.

## Tech stack (confirmed 2026-11-19; GitHub is the repository provider)

Built in SETUP-01. Run everything from the repo root with pnpm; see `README.md` for setup.

- **Monorepo:** pnpm 10 workspaces (`apps/*`, `packages/*`), one root `pnpm-lock.yaml`, Node 22.18+ (`.nvmrc`). Shared Prettier config at the root.
- **Shared rules — `packages/core` (`@pawcare/core`):** plain ESM TypeScript with no React Native or Node APIs (error codes, `RuleError`, field errors, validation and date rules, shared with the API and mobile). Built to `dist` by its `prepare` script on `pnpm install`. The API and mobile consume `dist`, so after editing core run `pnpm --filter @pawcare/core build` (or `pnpm build`) before their tests and typecheck see the change. Vitest specs sit next to the code.
- **API (parked) — `apps/api`:** NestJS 12, **ESM only** (relative imports end in `.js`; use `import.meta.dirname`, not `__dirname`). Uses **Vitest** (`vi.fn()`, not `jest.fn()`) and **oxlint**, which is what Nest 12 generates; see `apps/api/AGENTS.md`. Follow the `nestjs-mobile-backend` skill. The API is parked: it keeps building and its tests keep passing in CI, but feature stories don't change it, and it isn't deployed.
  - Config: `src/config/env.validation.ts` (class-validator). The app fails fast on an invalid env var, and errors never echo values. Read config only through `ConfigService<Env, true>`; never use `process.env` elsewhere.
  - HTTP setup lives in `src/app.setup.ts` (`configureApp`), shared by `main.ts` and the e2e tests. That covers helmet, URI versioning (feature routes under `/v1`), a whitelisting `ValidationPipe`, the global error filter, and shutdown hooks.
  - Errors: always `{ statusCode, code, message, details }`. Add codes to `src/common/errors/error-codes.ts` and throw `AppException`. Never rename an existing code.
  - Health: `/health` (liveness) and `/health/ready` (database check, 503 when down), both version-neutral. They never return config.
  - Database: Prisma 7 with the `prisma-client` generator (ESM output in `src/generated/prisma`, git-ignored) and `@prisma/adapter-pg`. Inject `PrismaService`. Migrations: `pnpm --filter api db:migrate --name <change>`. Declare composite same-owner FKs and partial unique indexes (preview feature `partialIndexes`) in `schema.prisma`. Hand-write CHECK constraints and triggers into the migration SQL, keep the existing "Hand-written" sections, and cover new rules in `test/schema-*.e2e-spec.ts`. CI fails if `schema.prisma` and the migrations drift.
  - Tests: unit specs sit next to the code in `src/**/*.spec.ts`; e2e specs in `test/*.e2e-spec.ts` run against a real PostgreSQL (`pnpm test:e2e`), using `configureApp`.
  - Docker: `compose.yaml` runs PostgreSQL and, optionally, the API dev server (`apps/api/Dockerfile`, `dev` stage, Node 22). It bind-mounts the repo, keeps `node_modules` in container volumes, and uses a fixed pnpm store path plus polling file watchers. When the host's Node isn't 22/24, run API commands with `docker compose exec api pnpm …`. Mobile commands still need host Node.
- **Mobile — `apps/mobile`:** Expo SDK 58, React Native 0.88, Expo Router (routes in `src/app/`; other code in `src/lib`, `src/components`; `@/` maps to `src/`). Add packages with `pnpm --filter mobile exec expo install <pkg>`, never `pnpm add`. Lint with `expo lint` (ESLint); unit-test plain logic with Vitest (`src/**/*.test.ts`). Read `apps/mobile/AGENTS.md`: Expo APIs change every SDK, so check the versioned docs rather than relying on memory.
  - Config: only `EXPO_PUBLIC_*` values (bundled, public). The (parked) API URL comes from `src/lib/config.ts`.
  - UI: built from the Figma file `vnDSwzyhB3cqzN7oBE9aq8` (page `00 Design System` plus 134 screens on `10–80 Screens`). Take colours, spacing, radii, type and shadows from `src/theme/tokens.ts`, which mirrors the Figma variables and styles; never hard-code hex values. Reuse the kit in `src/components/ui` (Button, Field, BottomSheet, StatusBadge, headers, screens…) before adding a component. Feature components go in `src/components`.
  - SVGs import as components through `react-native-svg-transformer` (`metro.config.js`, `svgr.config.js`). Icons in `assets/icons` are drawn in `#111111`, which becomes `currentColor`, so `<Icon color=…>` tints them.
  - Data: the on-phone data layer is `src/data` (see `apps/mobile/AGENTS.md`, "Data layer (LOCAL-01)"): an SQLCipher-encrypted SQLite database (`expo-sqlite` with `useSQLCipher`, key in `expo-secure-store`, `android.allowBackup: false`), `DataProvider`/`useData`/`useLiveQuery`, append-only migrations and a `change_log`. Encryption needs a **development or release build**; Expo Go runs unencrypted with the visible banner "Development data, not encrypted" (development only). Until a slice moves over, other screens still read the in-memory demo store (`src/lib/store.tsx`, seeded by `src/lib/seed.ts`, fixed clock `DEMO_NOW`); each feature ticket replaces its slice of the store with `src/data` calls. Derived state (care status, timeline, stock) lives in `src/lib/derive.ts`, `care-status.ts` and `timeline.ts`, with tests. Verification on a real Android device is still pending.
  - Motion: use `Animated` with `useNativeDriver: true` (transform and opacity only), hold values with `useState(() => new Animated.Value(…))`, and honour `useReducedMotion()` from `src/lib/motion.ts`. A touch handler inside a `BottomSheet` must claim the touch on start (`onStartShouldSetResponder`). Touches bubble through the React tree, so the screen's ScrollView behind the sheet would otherwise take it.
  - Screen transitions: every stack route has an entry in `SCREEN_TRANSITIONS` (`src/lib/motion.ts`), applied once in `src/app/_layout.tsx`; a test fails if a new route has none. Forms use `useDiscardGuard` (`src/components/discard-guard.tsx`) and navigate through its `leave` after saving.
  - Splash: the native splash (`expo-splash-screen` in `app.json`) hands over to `AnimatedSplash` (`src/components/animated-splash.tsx`). Keep its `imageWidth` (128) and `backgroundColor` (`bg.canvas`) in step with that component, or the hand-off jumps.
  - Test APK: see README "Build a test APK". On Windows it must be built from a short-path copy in `dist/b`.
- **CI:** `.github/workflows/ci.yml` runs a frozen-lockfile install, format check, lint, Prisma validate, migrations, typecheck, the core and API builds, unit tests, and e2e tests against Postgres 16, plus a separate mobile bundle job. All of it must pass before merge.
- **Later, each in its own ticket (don't add early):** auth provider (AUTH-01 brings Google sign-in and the upload of phone data to the owner's account), export/import to move phones (LOCAL-02), iOS verification of the phone database (LOCAL-01-IOS), push notifications, object storage + malware scanning, job queue/scheduler, rate limiting.

Before saying any work is done, run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e`.

## Git commits and pull requests

- **No Claude attribution, ever.** Don't add `Co-Authored-By`, `Claude-Session` or any other Claude trailer to commits, and don't add "Generated with Claude Code" or a claude.ai session link to PR descriptions. This rule overrides any default attribution. `.claude/settings.json` also sets `attribution` to hide it.
- Commit with the repository's configured git identity, never as Claude.
- Commit message format: `<TICKET-ID>: <description>` (e.g. `PF-02: Add pet registration endpoint`), a short imperative summary, then an optional body.
- Branch from `main` and name the branch after the ticket (e.g. `PF-02-register-pet`). `main` is protected: changes land through a PR with both CI checks green.

## Commands

- `/story <ID>` — load a story with its dependencies, open decisions, and a test plan
- `/implement-story <ID>` — test-first implementation of one story
- `/spec-check <ID>` — audit the current work against the story, shared requirements, and DoD
- `/backlog [filter]` — show backlog status / what's ready next
- Agent `spec-reviewer` — independent review of a diff against the spec
