# Product decisions & release gates

From spec v1.1. A ticket is not **Ready** while a decision affecting it is open.

| Decision | Status | Proposed default | Affected tickets |
| --- | --- | --- | --- |
| Appointment scope | ✅ Confirmed | Owner-maintained visit diary; arrangements happen outside PawCare | AP-01–AP-05 |
| Appointment changes | ✅ Confirmed | Owners edit/cancel any time; no provider cutoff | AP-03, AP-04 |
| Inventory ownership | ⏳ Open | Owner household; items linkable to several pets | IN-01–IN-04 |
| Shared caregivers | ⏳ Open | Excluded from first release | PF-01–PF-04; all permissions |
| Reminder defaults | ⏳ Open | 24h before appointments; 7 days before vaccines; medication times entered by owner | VC-04, RM-01–RM-04 |
| Permanent deletion | 🚫 Release gate | In-app reauthentication; product/legal to approve retention exceptions and a measurable completion target | FN-02 |
| Supported iOS/Android versions | 🚫 Release gate | Agree at refinement | All (QA) |
| Technology stack | ✅ Confirmed | Expo + React Native + TS, NestJS, PostgreSQL + Prisma, pnpm workspaces | SETUP-01 → everything |
| Repository provider | ✅ Confirmed | GitHub (Actions, branch protection, secret scanning) | SETUP-01 |
| PR approvers / merge rights | ⏳ Open | — | SETUP-01 |
| Pet weight range by species | ⏳ Open | >0 to 1,000 kg | PF-02 |
| D-ERD-1 Prescription zone vs owner zone change | ⏳ Open (spec conflict) | RM-01 says medication times move with owner zone; ERD keeps per-prescription zone. Proposed: prescription zone follows owner zone by default | RM-01, VC-02, VC-03 |
| D-ERD-2 Archive with past Planned (Needs Update) visits | ⏳ Open | Block archive on *any* Planned visit, not only upcoming | PF-04, AP-05 |
| D-ERD-3 Vaccine fulfillment cardinality | ⏳ Open | One administration fulfills at most one due item; unique FK | VC-04 |
| D-ERD-4 Public ID format | ⏳ Open | UUIDv7 for every API-exposed ID (no sequential IDs) | FN-01, all |

See `docs/design/erd-review.md` for the full ERD review.

## Decision log

Record resolved decisions here (date, decision, who approved, affected tickets).

- 2026-11-04 — Scope confirmed by product owner: pet owners only; appointment records always labeled Owner-entered.
- 2026-11-19 — Stack confirmed by the user: Expo + React Native + TypeScript, NestJS, PostgreSQL + Prisma, pnpm workspaces. Repository provider: GitHub.
- 2026-11-19 — SETUP-01 tooling: the API uses Vitest and oxlint instead of the Jest/ESLint proposed in the ticket. NestJS 12 is ESM-only and generates projects with Vitest and oxlint; Jest needs extra ESM workarounds. The mobile app keeps ESLint (`expo lint`). Revisit if the team prefers Jest.
