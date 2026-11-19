# PawCare — project guide for Claude

PawCare is a **mobile pet diary for pet owners**: pet profiles, owner-entered health history, vaccines, prescriptions, an appointment diary, reminders, and household supplies. Release 1 is **owner-only**.

The product spec is the source of truth. Read it before designing or coding anything:

- `docs/spec/00-overview.md` — scope, working assumptions, open decisions, **shared requirements**, delivery sequence, Definition of Ready/Done, deferred backlog
- `docs/spec/epics/<EPIC>.md` — stories with acceptance criteria (FN, PF, MR, VC, AP, RM, IN)
- `docs/backlog.csv` — 7 epics + 27 stories with priority, status, dependencies
- `docs/decisions.md` — open product decisions and release gates
- `docs/design/erd-and-flows.md` — proposed logical data model (Mermaid ERDs) and 8 app flowcharts
- `docs/design/erd-review.md` — known gaps/conflicts in that design; check before touching the affected tables

## Data model rules (from the ERD)

- `CARE_RECORDS` is the shared parent for MEDICAL / VACCINE / PRESCRIPTION / APPOINTMENT; exactly one matching subtype row, written in the same transaction. Appointments are never voided.
- Same-owner composite FKs everywhere (e.g. `CARE_RECORDS(owner_id, pet_id) → PETS(owner_id, id)`); an ID alone is never authorization.
- Derived, not stored: health timeline, Care Due, overdue status, Needs Update, physical/usable stock.
- Inventory is an immutable ledger (`STOCK_TRANSACTIONS` + `STOCK_ENTRIES`); batch balances are a locked transactional cache; reversals are compensating entries.
- Reminders: `REMINDER_SCHEDULES` with exactly one typed source FK + CHECK; versioned; occurrences are the inbox (no separate notifications table); push deliveries per device token.
- Every mutation commits its `OUTBOX_EVENTS` row atomically; idempotency via `IDEMPOTENCY_REQUESTS(owner_id, operation, request_key)`.
- Dose occurrences are generated over a rolling window; regeneration never erases logs or duplicates alerts.

Origin: Notion "PawCare_Backlog_Specifications" v1.1 (4 Nov 2026). If the spec and this file ever disagree, the spec wins — flag the conflict.

## How to work on a story

1. Load the story (`/story <ID>`) and its dependencies. Check `docs/decisions.md` for anything blocking it.
2. Map every **Given/When/Then** to at least one automated test before implementing; also cover the story's "Edge Cases & Failure Points".
3. Implement API + data model + mobile UI states (loading / empty / error / retry).
4. Verify against the 8 shared requirements and the Definition of Done (`/spec-check <ID>`).
5. Update the story's `Status` in `docs/backlog.csv`.

Don't mark a story Done while an integration adapter it lists (e.g. a reminder source, a timeline source) is still missing — split it into a linked subtask instead.

## Product guardrails (never violate)

- **No clinical judgment.** PawCare never diagnoses, prescribes, calculates doses, infers vaccine intervals, or converts units/doses. Health records are labeled **Owner-entered**, never "verified".
- **Appointments are a diary, not bookings.** No clinic accounts, availability, reservations, confirmations, or messages. Use the exact copy from AP-01/AP-03/AP-04 (e.g. "Saved to your diary. Arrange or confirm this visit directly with your clinic").
- **Reminders never act on their own.** A reminder never marks care complete, logs a dose as taken, deducts stock, or infers appointment attendance. Cross-feature effects happen only through explicit user actions.
- **Archive/void, don't delete.** Everyday corrections use archive or void (with reason). Permanent deletion exists only in FN-02 account deletion.
- **Out of scope for v1:** shared caregivers, offline sync, clinic integrations/EMR, data export, payments, telehealth, dose calculators, complex recurrence (only fixed daily times), barcodes/purchasing, AI features. Don't build these "just in case".

## Engineering rules (shared requirements, condensed)

- **Authorization:** check ownership server-side on every request, including nested resources and attachments. Inaccessible = generic not-found; leak nothing (names, counts, existence).
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

- **Monorepo:** pnpm 10 workspaces (`apps/*`), one root `pnpm-lock.yaml`, Node 22.18+ (`.nvmrc`). Shared Prettier config at the root.
- **API — `apps/api`:** NestJS 12, **ESM only** (relative imports end in `.js`; use `import.meta.dirname`, not `__dirname`). Uses **Vitest** (`vi.fn()`, not `jest.fn()`) and **oxlint**, which is what Nest 12 generates; see `apps/api/AGENTS.md`. Follow the `nestjs-mobile-backend` skill.
  - Config: `src/config/env.validation.ts` (class-validator). The app fails fast on an invalid env var, and errors never echo values. Read config only through `ConfigService<Env, true>`; never use `process.env` elsewhere.
  - HTTP setup lives in `src/app.setup.ts` (`configureApp`), shared by `main.ts` and the e2e tests. That covers helmet, URI versioning (feature routes under `/v1`), a whitelisting `ValidationPipe`, the global error filter, and shutdown hooks.
  - Errors: always `{ statusCode, code, message, details }`. Add codes to `src/common/errors/error-codes.ts` and throw `AppException`. Never rename an existing code.
  - Health: `/health` (liveness) and `/health/ready` (database check, 503 when down), both version-neutral. They never return config.
  - Database: Prisma 7 with the `prisma-client` generator (ESM output in `src/generated/prisma`, git-ignored) and `@prisma/adapter-pg`. Inject `PrismaService`. Migrations: `pnpm --filter api db:migrate --name <change>`. Hand-write the CHECK constraints, partial unique indexes and composite same-owner FKs from the ERD into the migration SQL.
  - Tests: unit specs sit next to the code in `src/**/*.spec.ts`; e2e specs in `test/*.e2e-spec.ts` run against a real PostgreSQL (`pnpm test:e2e`), using `configureApp`.
- **Mobile — `apps/mobile`:** Expo SDK 58, React Native 0.88, Expo Router (routes in `src/app/`; other code in `src/lib`, `src/components`; `@/` maps to `src/`). Add packages with `pnpm --filter mobile exec expo install <pkg>`, never `pnpm add`. Lint with `expo lint` (ESLint); unit-test plain logic with Vitest (`src/**/*.test.ts`). Read `apps/mobile/AGENTS.md`: Expo APIs change every SDK, so check the versioned docs rather than relying on memory.
  - Config: only `EXPO_PUBLIC_*` values (bundled, public). The API URL comes from `src/lib/config.ts`.
- **CI:** `.github/workflows/ci.yml` runs a frozen-lockfile install, format check, lint, Prisma validate, migrations, typecheck, the API build, unit tests, and e2e tests against Postgres 16, plus a separate mobile bundle job. All of it must pass before merge.
- **Later, each in its own ticket (don't add early):** auth provider, push notifications, object storage + malware scanning, job queue/scheduler, rate limiting.

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
