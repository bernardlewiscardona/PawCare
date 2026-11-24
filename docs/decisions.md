# Product decisions & release gates

From spec v1.1. A ticket is not **Ready** while a decision affecting it is open.

| Decision | Status | Proposed default | Affected tickets |
| --- | --- | --- | --- |
| Appointment scope | ✅ Confirmed | Owner-maintained visit diary; arrangements happen outside PawCare | AP-01–AP-05 |
| Appointment changes | ✅ Confirmed | Owners edit/cancel any time; no provider cutoff | AP-03, AP-04 |
| Inventory ownership | ⏳ Open | Owner household; items linkable to several pets | IN-01–IN-04 |
| Shared caregivers | ✅ Confirmed 2026-11-23 | Excluded from the first release (owner-only) | PF-01–PF-04; all permissions |
| Reminder defaults | ⏳ Open | 24h before appointments; 7 days before vaccines; medication times entered by owner | VC-04, RM-01–RM-04 |
| Permanent deletion | 🚫 Release gate | In-app reauthentication; product/legal to approve retention exceptions and a measurable completion target | FN-02 |
| Supported iOS/Android versions | 🚫 Release gate | Agree at refinement | All (QA) |
| Technology stack | ✅ Confirmed | Expo + React Native + TS, NestJS, PostgreSQL + Prisma, pnpm workspaces | SETUP-01 → everything |
| Repository provider | ✅ Confirmed | GitHub (Actions, branch protection, secret scanning) | SETUP-01 |
| PR approvers / merge rights | ⏳ Open | — | SETUP-01 |
| Pet weight range by species | ✅ Confirmed 2026-11-23 | One range for every species: >0 to 1,000 kg, 1 g steps (no per-species limits) | PF-02 |
| Pet weight display unit | ✅ Confirmed 2026-11-23 | kg or lb for body weight only, saved as an owner preference; always stored in kg | PF-01, PF-02 |
| Pet photo in PF-02 | ✅ Confirmed 2026-11-23 | Deferred until MR-02 file storage and scanning exist; pets save without a photo | PF-02, MR-02 |
| Pets need a finished owner profile | ✅ Confirmed 2026-11-23 | `POST /v1/pets` returns 409 `PROFILE_SETUP_REQUIRED` until PF-01 setup is done, so pet dates use the owner's real time zone (fixes `erd-review.md` item 9 for pets) | PF-02, PF-02-APP |
| Species list | ✅ Confirmed 2026-11-23 | Dog, Cat, Bird, Rabbit, Other (Other requires a description) | PF-02 |
| D-ERD-1 Prescription zone vs owner zone change | ✅ Confirmed 2026-11-23 | Prescriptions follow the owner zone by default (`prescriptions.follows_owner_zone`, default true); `time_zone` holds the effective zone | RM-01, VC-02, VC-03 |
| D-ERD-2 Archive with past Planned (Needs Update) visits | ⏳ Open | Block archive on *any* Planned visit, not only upcoming | PF-04, AP-05 |
| D-ERD-3 Vaccine fulfillment cardinality | ✅ Confirmed 2026-11-23 | One administration fulfills at most one due item; unique FK | VC-04 |
| D-ERD-4 Public ID format | ✅ Confirmed 2026-11-23 | UUIDv7 for every ID, generated in the database (no sequential IDs) | FN-01, all |
| Sign-in timing | ✅ Confirmed 2026-11-23 | Postponed. Development-only `X-Dev-Owner` header (`AUTH_MODE=dev`, refused in production) until AUTH-01 adds Google sign-in | FN-01, AUTH-01, all |
| Release 1 is local-first | ✅ Confirmed 2026-11-24 | Data lives in an encrypted SQLite database on the phone; the NestJS API is parked, not deleted. Shared rules live in `packages/core`. Android is checked now, iOS later as `LOCAL-01-IOS`; Expo Go is allowed in development only (unencrypted, with a visible banner) | LOCAL-01, all |

See `docs/design/erd-review.md` for the full ERD review.

## Decision log

Record resolved decisions here (date, decision, who approved, affected tickets).

- 2026-11-04 — Scope confirmed by product owner: pet owners only; appointment records always labeled Owner-entered.
- 2026-11-19 — Stack confirmed by the user: Expo + React Native + TypeScript, NestJS, PostgreSQL + Prisma, pnpm workspaces. Repository provider: GitHub.
- 2026-11-19 — SETUP-01 tooling: the API uses Vitest and oxlint instead of the Jest/ESLint proposed in the ticket. NestJS 12 is ESM-only and generates projects with Vitest and oxlint; Jest needs extra ESM workarounds. The mobile app keeps ESLint (`expo lint`). Revisit if the team prefers Jest.
- 2026-11-23 — ERD decisions approved by the user while implementing the database schema (branch `SETUP-01_Migrations`): D-ERD-1 prescription zone follows the owner zone by default (`follows_owner_zone`); D-ERD-3 one administration fulfills at most one due item; D-ERD-4 UUIDv7 IDs everywhere. The schema also applies the `erd-review.md` fixes for items 5, 6, 7, 10, 12, 14 and 15. D-ERD-2 (archive with Needs Update visits) is application logic and stays open.
- 2026-11-23 — Sign-in postponed by the user; Google sign-in (OAuth) planned as AUTH-01. Until then the API identifies the owner from a development-only `X-Dev-Owner` header (`AUTH_MODE=dev`). The app still saves to the API; it is not an offline app (superseded 24 Nov 2026). FN-01's expired-session criterion moves to AUTH-01.
- 2026-11-23 — PF-02 refinement, approved by the user: one weight range for every species (>0–1,000 kg); kg/lb display unit for body weight only, as an owner preference (the "never convert units" guardrail covers doses and clinical units, not body weight display); pet photos deferred until MR-02; species list confirmed; shared caregivers excluded from release 1.
- 2026-11-23 — PF-02 spec review, fixes approved by the user: an owner must finish profile setup before adding a pet (409 `PROFILE_SETUP_REQUIRED`; the app sends them to setup), so "today" is never the placeholder UTC date. Kilograms take at most 3 decimals and the range is checked before rounding; the weight error names the limit in the unit the owner typed. Birth and measurement dates before 1900 are rejected.
- 2026-11-24 — Release 1 becomes local-first, for privacy and cost: health data stays in an encrypted SQLite database on the owner's phone and no server is needed to ship. The API is parked and its rules move to `packages/core` so both sides share one copy. Android is verified now; iOS follows as `LOCAL-01-IOS`. Expo Go is a development-only exception (database not encrypted, shown with a banner).
