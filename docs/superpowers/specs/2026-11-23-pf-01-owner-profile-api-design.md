# PF-01 — Owner profile API

Date: 23 Nov 2026 · Status: approved 23 Nov 2026, implemented on `PF-01-owner-profile` · Ticket: PF-01 (spec: `docs/spec/epics/PF.md`)

## Intent

The owner keeps their display name, phone number and time zone up to date, so PawCare can
identify them and, later, schedule reminders in the right zone. This ticket is **backend only**:
another developer builds the app screens against the API, using Swagger (`/docs`) as the
contract and the `apps/mobile/src/lib/api.ts` client from FN-01.

Owners are created automatically on their first request (FN-01) with placeholder values
(`Dev owner <name>`, `UTC`). The app needs to know whether to show profile setup, so the API
says so with `profileSetupRequired`.

## Goals

1. `PATCH /v1/me` saves display name, phone and time zone with server-side, field-level
   validation.
2. `GET /v1/me` and the `PATCH` response include `profileSetupRequired`: `true` until the owner
   has saved their profile once.
3. Edits are protected by `version`: a stale edit gets `409 CONFLICT`, never a silent overwrite.
4. Every successful edit writes an audit event and an outbox event in the same transaction.

## Non-goals

- App screens, loading/error states, removing demo data (the app developer's work; tracked as
  a linked app subtask).
- Avatar upload (needs file storage and scanning; a follow-up after MR-02).
- Email or sign-in identity changes (AUTH-01 and a separate verified workflow).
- Regenerating reminders when the time zone changes (RM-01 consumes the outbox event later).

## Anti-goals

- Requiring a phone number (or an address) just to keep a diary.
- Health text, names or phone numbers in logs, audit metadata or outbox payloads.
- Changing the existing `GET /v1/me` fields or the existing `VALIDATION_FAILED` details shape
  (only additions).

## Constraints

- Spec PF-01: display name 1–100 trimmed characters (Unicode allowed); valid IANA zone; optional
  phone normalised to international format, or a field error asking for the country code and a
  valid number; identity unchanged by edits. Edge cases: Unicode names, whitespace-only values,
  invalid zones, network failure, concurrent edits.
- Shared requirements 2 (field-level errors, success only after acknowledgement), 3 (version
  conflicts), 6 (audit without health text), and CLAUDE.md: every mutation commits its
  `OUTBOX_EVENTS` row atomically.
- Owner rules from FN-01 (`apps/api/AGENTS.md`): the owner comes from `@CurrentOwner()` only.
- Existing DB CHECKs on `owners` (display name, phone 1–30 chars, time zone 1–64 chars).

## Approaches considered (for `profileSetupRequired`)

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| **A. `owners.profile_completed_at` timestamp, set on the first profile save** | Explicit, survives Google sign-in (Google gives a name but no time zone), records when; one small migration | **Chosen by the owner** |
| B. Derive from placeholder values (`Dev owner…` name or `UTC` zone) | No migration, but wrong for real UTC users and breaks once Google supplies names | Rejected |
| C. Boolean column | Like A but loses the timestamp | Rejected |

## Design (decided)

**Migration.** Add `owners.profile_completed_at timestamptz NULL`. Once set it is never
cleared. Existing owners stay `NULL` (setup required).

**`GET /v1/me`** gains `profileSetupRequired: boolean` (`profile_completed_at IS NULL`).
All existing fields stay as they are.

**`PATCH /v1/me`.** Body (all optional except `version`):

| Field | Rule |
| --- | --- |
| `version` | Required integer: the version the app last read |
| `displayName` | Trimmed; 1–100 characters counted as Unicode code points; whitespace-only rejected |
| `timeZone` | A zone Node knows (`Intl.supportedValuesOf('timeZone')`) or `UTC` |
| `phone` | String or `null` (removes it). Must start with `+` and a country code; validated and stored in E.164 (`+639171234567`) with `libphonenumber-js` |

- **First save completes setup:** while `profileSetupRequired` is true, the body must include
  both `displayName` and `timeZone`, or the request fails with field errors on the missing ones.
  A successful first save sets `profile_completed_at`. After that, any single field may change.
- Unknown fields are rejected (existing whitelisting `ValidationPipe`). `authSubject`, `id` and
  account status can't be sent.
- **Conflict check:** the update applies only where `id = owner AND version = body.version`, and
  increments `version`. If nothing matched, respond `409 CONFLICT` with
  `details: { current: <the owner's current profile> }`, so the app can show what changed
  (it's the owner's own data). This also covers a retried request whose first attempt already
  succeeded.
- A body with only `version` (no changes) returns the current profile unchanged, with no
  version bump and no events.
- **Same transaction:** the update, an `audit_events` row (`action: owner.profile_updated`,
  `object_type: owner`, `change_metadata: { fields: ["displayName", …] }`, names of changed
  fields only), and an `outbox_events` row (`event_type: owner.profile_updated`,
  `aggregate_type: owner`, `aggregate_version` = new version,
  `payload: { changedFields: […], timeZoneChanged: boolean }`, no values).
- **Response:** `200` with the full profile, including the new `version` and
  `profileSetupRequired: false`.

**Field-level validation errors.** `VALIDATION_FAILED` keeps `details.errors` (the existing list
of messages) and adds `details.fields`: `{ "<field>": ["message", …] }`. Domain checks (phone,
time zone, first-save requirements) use the same shape. This applies to every endpoint.

**Error codes.** Reuse `VALIDATION_FAILED` (400), `CONFLICT` (409), `UNAUTHORIZED` (401). No new
codes.

## Tests (written first)

- Unit: display-name rules (trim, Unicode such as `Bé Ánh 🐾`, 100 vs 101 code points,
  whitespace-only); time zone (`Asia/Manila`, `UTC` accepted; `Mars/Base`, `GMT+8` rejected);
  phone (`+63 917 123 4567` → `+639171234567`, `+44 20 7946 0958` accepted; `09171234567`
  without country code and `+63 123` rejected with the country-code message; `null` clears).
- e2e (`AUTH_MODE=dev`, real database):
  - `GET /v1/me` for a new owner → `profileSetupRequired: true`.
  - First `PATCH` with name and zone → 200, `profileSetupRequired: false`, version 2; reopening
    with `GET` returns the saved values.
  - First `PATCH` missing `timeZone` → 400 with `details.fields.timeZone`; input not saved.
  - Later `PATCH` with only `phone` → 200; normalised value returned.
  - Stale `version` → 409 with `details.current`; nothing changed.
  - Two concurrent `PATCH`es with the same version → exactly one 200, one 409.
  - Unknown field (`authSubject`) → 400; no header → 401.
  - Successful edit writes exactly one audit row and one outbox row with field names only (no
    name, phone or zone values); a failed edit writes neither.
  - Owner B's `PATCH` never changes owner A (each owner only ever reaches their own profile).

## Docs and backlog

- `docs/backlog.csv`: PF-01 → In Progress; add `PF-01-APP` "Owner profile screens on the API"
  (app developer, depends on PF-01). PF-01 is marked Done when the API ships; the app subtask
  tracks the screens.
- `CLAUDE.md`: our stories are API-only; app screens belong to the app developer, tracked as
  `<ID>-APP` subtasks.
- README: example `PATCH /v1/me` request.
- `apps/api/AGENTS.md`: the field-level error shape and the "update where version matches,
  else 409 with current" pattern for every editable resource.

## Calls made while writing this up

- **Branch:** `PF-01-owner-profile`, from `main` once the FN-01 PR has merged (otherwise from
  `FN-01-owner-access`, rebased after it merges).
- **`version` in the body**, not an `If-Match` header: simpler for the app, same for every
  resource.
- **New dependency:** `libphonenumber-js` (min metadata) in `apps/api`.
- **Stored values:** the display name is stored trimmed; the phone in E.164; the zone as sent.
- **Outbox rows wait:** nothing consumes outbox events yet (the job-queue ticket adds that), so
  rows stay `PENDING`. Tests assert the row, not a consumer.
- **Retries:** no idempotency key for profile edits; the version check makes a retried edit
  return 409 with the current profile, which already shows the change.

## Left to the builder

DTO and validator structure, where the profile rules live (service or small validation module),
the exact update query, and the migration name.
