# FN-01 — Owner access boundaries with a development owner identity

Date: 23 Nov 2026 · Status: awaiting approval · Ticket: FN-01 (spec: `docs/spec/epics/FN.md`)

## Intent

Feature work (PF-01 onward) needs to know which owner each API request belongs to, so every
query can be scoped to that owner. Real sign-in is postponed: the owner wants to skip login for
now and add **Google sign-in (OAuth)** later. The app still saves to the API and the PostgreSQL
schema from SETUP-01; it is not an offline app.

This ticket gives the API a **development-only owner identity** and the ownership rules every
later endpoint follows, so that adding Google sign-in later replaces only the part that works
out who the caller is.

## Goals

1. Every `/v1` request resolves to exactly one current owner, or is rejected with 401.
2. In development and tests, the caller names their owner with an `X-Dev-Owner` header. This
   works only when the API runs with `AUTH_MODE=dev`.
3. One ownership rule for all endpoints: the owner always comes from the resolved identity,
   never from the request body, path or query, and every owner-resource query filters by
   `owner_id`. Something that belongs to another owner gets the same `404 NOT_FOUND` response
   as something that doesn't exist.
4. `GET /v1/me` is the first owner-scoped endpoint and proves the mechanism end to end.
5. The mobile app gets a small API helper that sends the header, ready for PF-01 to use.

## Non-goals

- Google sign-in, sessions, token expiry, logout (a new ticket, AUTH-01).
- Editing the profile (PF-01). Onboarding screens stay on demo data.
- Account deletion (FN-02), rate limiting.
- Switching any mobile screen from the demo store to the API.

## Anti-goals (a failure even if everything else works)

- The `X-Dev-Owner` header is accepted by a production API.
- Any response reveals that another owner's record exists: different status, message, timing
  path or `details` for "exists but not yours" versus "doesn't exist".
- Any endpoint trusts an owner ID supplied by the client.

## Constraints

- Spec: shared requirement 1 (server-side authorization, generic not-found), shared
  requirement 6 (no identifiers or health text in logs), error shape
  `{ statusCode, code, message, details }`, existing codes only (`UNAUTHORIZED`, `NOT_FOUND`).
- Config is read only through `ConfigService<Env, true>`; the app fails fast on invalid config
  without echoing values.
- Mobile config is `EXPO_PUBLIC_*` only (public, bundled).
- The spec (`00-overview.md`) says authentication exists before feature delivery. Postponing it
  is a product decision and must be logged in `docs/decisions.md`.

## Approaches considered

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| A. One fixed development owner from config | Simplest, but every request is the same owner, so cross-owner isolation (the point of FN-01) can't be tested over HTTP | Rejected |
| **B. Development-only `X-Dev-Owner` header** | Small; tests switch owners per request; the later Google switch replaces only the identity resolver | **Chosen by the owner** |
| C. Self-issued development tokens | Closest to the final shape, but more work now and a token-minting endpoint that could ship by mistake | Rejected |

## Design (decided)

**Auth mode.** New env var `AUTH_MODE`, values `none` (default) and `dev`. Google later adds
`google`.
- `none`: every `/v1` route returns 401. Safe default when nothing is configured.
- `dev`: the `X-Dev-Owner` header identifies the owner.
- Startup fails if `NODE_ENV=production` and `AUTH_MODE=dev`, with an actionable message that
  doesn't echo values.

**The header.** `X-Dev-Owner: <name>`, where name is 1–64 characters of `A–Z a–z 0–9 _ -`.
The owner's `auth_subject` is stored as `dev:<name>`. The prefix means development owners can
never collide with Google owners (stored as `google:<sub>` later).

**Resolving the owner.** A global guard runs on every route except those marked public (the
health endpoints). It asks an identity resolver for the subject (only `DevHeaderResolver` for
now), then finds or creates the owner by `auth_subject`.
- First request with a new name creates the owner with display name `Dev owner <name>`
  (trimmed to 100 characters) and time zone `UTC`. PF-01 lets the owner change both.
- Find-or-create must be safe under concurrent first requests (unique `auth_subject`; on a
  conflict, read the existing row).
- Missing or malformed header, `AUTH_MODE=none`, or an owner whose `account_status` isn't
  `ACTIVE` → `401 UNAUTHORIZED`, message `Sign-in required`, `details: null`. The response never
  says which of these happened.
- The resolved owner ID is attached to the request and read with a `@CurrentOwner()` parameter
  decorator. Services take `ownerId` as an argument.

**Ownership rule for every endpoint (documented in `apps/api/AGENTS.md`).**
- Look up owner resources with `id` **and** `ownerId` together, never by `id` alone.
- Not found and not yours → throw `NOT_FOUND` with the same message and `details: null`.
- Never accept `ownerId` from the client.
- Every resource ticket from PF-02 on adds e2e tests that owner B gets the identical 404 for
  owner A's IDs, including nested resources.

**`GET /v1/me`.** Returns the current owner: `id`, `displayName`, `phone`, `timeZone`,
`version`. No `auth_subject`, no account status.

**Logging.** Neither the header value nor `auth_subject` is logged.

**OpenAPI.** Document the `X-Dev-Owner` header as an API-key security scheme so Swagger UI can
send it in development.

**Mobile.** `src/lib/api.ts`: a `fetch` helper that prefixes `apiBaseUrl`, sends JSON, adds
`X-Dev-Owner` from `EXPO_PUBLIC_DEV_OWNER` when set, and turns error bodies into a typed error
carrying `code`. `.env.example` documents `EXPO_PUBLIC_DEV_OWNER`. No screen uses it yet.

**Docs and backlog.**
- `docs/decisions.md`: "Sign-in postponed; `X-Dev-Owner` in development until AUTH-01 (Google)."
- `docs/backlog.csv`: add `AUTH-01 Sign in with Google` (Proposed). FN-01 moves to In Progress.
  FN-01's third criterion (expired session rejected) moves to AUTH-01. Its first two are met per
  resource as each resource ticket ships its cross-owner tests, so FN-01 isn't marked Done until
  those exist.
- `README.md`: how to set `AUTH_MODE=dev` and send the header (curl and Swagger).

## Tests (written first)

- Env validation: `AUTH_MODE` defaults to `none`; unknown values fail; `production` + `dev`
  fails without echoing values.
- Resolver: valid names accepted; empty, too long and invalid characters rejected; subject is
  `dev:<name>`.
- e2e with `AUTH_MODE=dev`: no header → 401 in the standard shape; malformed header → 401;
  `/health` and `/health/ready` need no header; first request creates the owner; the same
  header returns the same owner; two headers give two different owners and `/v1/me` returns
  only the caller's; a non-`ACTIVE` owner → 401; concurrent first requests create one owner.
- e2e with `AUTH_MODE=none`: `/v1/me` → 401 even with the header.
- Mobile: the API helper adds the header only when configured and maps error bodies.

## Calls made while writing this up

- **Branch:** `FN-01-owner-access`, branched from `SETUP-01_Migrations` because FN-01 needs the
  schema; rebase onto `main` once the SETUP-01 PR merges.
- **Tests set their own auth mode:** e2e specs build the app with `AUTH_MODE` overridden
  (`dev` or `none`), so CI needs no new environment variables.
- **Spec wording:** add a note to FN-01 in `docs/spec/epics/FN.md` that the expired-session
  criterion moves to AUTH-01 and that sign-in is postponed (pointing to the decision).
- **Dev owner defaults:** `UTC` and `Dev owner <name>` are placeholders only; nothing else
  (reminder preferences, pets) is created with the owner.

## Left to the builder

Module and file layout, the find-or-create query, how the guard is registered, exact Swagger
wiring, and the mobile helper's function signatures.
