# PawCare — Product Backlog Specifications

Version: 1.1 — Owner-only scope · 4 November 2026 · Status: Proposed product specification


## Product and scope

PawCare is a mobile pet diary that helps owners manage pet profiles, health history, vaccines, prescriptions, appointments, reminders, and household supplies in one place.

The ticket IDs below are proposed backlog identifiers, not existing Jira or Notion records. Priorities and business rules are recommendations for product review. Estimates should be assigned by engineering after refinement.

### Working assumptions

- One authenticated owner account can manage multiple pets. Shared ownership, transfers, and caregiver invitations are deferred.
- Owners manually maintain health records. These are labeled owner-entered and are not represented as veterinarian-verified records. PawCare does not diagnose, prescribe, or calculate doses.
- Inventory means household food, medication, and pet supplies; it excludes clinic stock, purchasing, sales, and financial accounting.
- Only pet owners use this release. Appointment management is a personal diary: owners record visits arranged outside PawCare, edit their details, and mark outcomes. PawCare does not contact clinics, check live availability, reserve slots, or confirm/cancel appointments with providers. No clinic accounts, staff portal, provider approval, or clinic integrations are included.
- The mobile application requires connectivity for reads and writes in this first release. Forms retain unsent input while the screen remains open, but offline synchronization is deferred. Notification delivery is best effort.
- Pets and associated records use archive/void actions for everyday corrections. Account deletion is a separate permanent deletion workflow.
- Registration, sign-in, email verification, password recovery, and session management must exist before feature delivery. Their implementation is a prerequisite, not specified in this feature backlog.

### Decisions to confirm before affected tickets enter development

| Decision | Proposed default | Affected tickets |
| --- | --- | --- |
| Appointment scope — confirmed | Owner-maintained visit diary; arrangements take place outside PawCare | AP-01–AP-05 |
| Inventory ownership | Owner household; items can be linked to several pets | IN-01–IN-04 |
| Shared caregivers | Excluded from first release | PF-01–PF-04; all permissions |
| Reminder defaults | 24 hours before appointments; 7 days before vaccines; medication times entered by owner | VC-04, RM-01–RM-04 |
| Appointment changes — confirmed | Owners update their diary at any time; no provider cancellation cutoff is enforced | AP-03, AP-04 |
| Permanent deletion | In-app reauthentication; product/legal to approve retention exceptions and deletion completion target before release | FN-02 |

Scope confirmed by the product owner: pet owners only. Appointment records are always labeled Owner-entered. Saving, editing, or canceling a diary entry never implies provider confirmation or communication.


## Shared requirements — apply to every story

1. Authorize every API request against the current owner. Never rely on client filtering. Return a generic unavailable/not-found result for inaccessible objects; expose no names, attachments, counts, or notification details.
2. Use server validation and field-level mobile errors. Preserve entered values after validation/network errors; show success only after server acknowledgement. Disable duplicate submissions and support safe retry with request identifiers for creates and transactional actions.
3. Use stable IDs, pagination for collections (default 20, maximum 100), deterministic sorting, and version-based conflict detection for edits. A stale update returns a conflict and a refresh/review action rather than overwriting newer data.
4. Store event instants in UTC plus the relevant IANA time zone. Store date-only facts, such as birth dates and vaccine administration dates, as dates without UTC conversion. Use the explicitly entered appointment time zone for visit instants and owner time for owner-local reminders; display the zone where confusion is possible.
5. Provide loading, empty, error, and retry states. Support screen readers, labeled controls, scalable text, and status information that does not depend on color alone. Validate critical journeys on supported iOS and Android versions agreed at refinement.
6. Encrypt transport and stored sensitive data; exclude health details, tokens, and attachment URLs from diagnostic logs. Record actor, timestamp, action, and object ID for material mutations. Avoid storing health text in audit logs that could survive deletion.
7. Archive actions preserve history, hide items from active selectors, and cancel pending source reminders. Archive must be blocked when an object has upcoming Planned appointments unless those diary entries are canceled first.
8. A reminder never automatically marks care complete, records medication taken, or deducts stock. Cross-feature effects occur only through explicit, specified actions.


## Epic overview

| Epic ID | Feature summary | Stories | Priority |
| --- | --- | --- | --- |
| FN | Foundation: isolate owner data and support account deletion | FN-01–FN-02 | High |
| PF | Pet and owner profiles: maintain identity and manage multiple pets | PF-01–PF-04 | High |
| MR | Medical records: create, attach, browse, and correct health history | MR-01–MR-04 | High |
| VC | Vaccines and prescriptions: record care and track actionable dates | VC-01–VC-04 | High |
| AP | Appointment diary: record visits, update details, and track outcomes | AP-01–AP-05 | High |
| RM | Reminders: configure, generate, deliver, and act on care alerts | RM-01–RM-04 | High |
| IN | Inventory: track household quantities, use, thresholds, and expiry | IN-01–IN-04 | Medium |

Each epic is an **Issue Type: Epic**. Its completion requires all child acceptance criteria and the shared Definition of Done below. This backlog contains 27 user stories and 7 epics.



## Suggested delivery sequence

1. **Foundation and diary:** Authentication prerequisite; FN-01; PF-01/PF-02/PF-03; MR-01/MR-02/MR-04; VC-01/VC-02; timeline medical/vaccine/prescription support in MR-03.
2. **Care tracking and reminders:** RM-01/RM-02, VC-03/VC-04, RM-03/RM-04. Build a source-neutral reminder engine first; enable each source only when its underlying lifecycle is implemented.
3. **Owner appointment diary:** AP-01–AP-05, then complete the appointment timeline adapter and reminder integration. No clinic participation, slot management, or provider communication is required.
4. **Inventory:** IN-01–IN-04 and inventory alert integration.
5. **Release completion:** PF-04 archive integration and FN-02 deletion across every delivered resource; cross-account and lifecycle acceptance checks.

Some stories intentionally require integration with later source types. They remain open until all their listed source adapters pass acceptance tests; teams may split those adapters into linked engineering subtasks rather than declare partial completion Done.


## Definition of Ready

A ticket is Ready only when its scope decisions are resolved, dependencies and API/data contracts are identified, designs cover loading/empty/error states, and the team can demonstrate how each criterion will be tested. Deletion and platform-support decisions are release gates; do not silently substitute implementation assumptions for them.


## Definition of Done

- All ticket and shared acceptance criteria pass, including relevant invalid-input and authorization scenarios.
- API validation, database constraints, concurrency protection, and required audit metadata are implemented; migrations are reviewed and reversible where applicable.
- Critical automated checks cover cross-owner access, duplicate appointment creation, idempotent retry, stale updates, timezone transitions, canceled-source reminders, and concurrent stock deductions.
- Mobile QA covers supported iOS/Android devices, notification permission denial, failed network requests, accessibility, and notification deep links.
- Operational visibility covers failed scheduled jobs, undelivered outbox events, notification retries, file scanning/cleanup, and deletion failures without logging sensitive content.
- Product review confirms the terminology and workflows; no open release-blocking defects or unresolved policy gates remain.


## Deferred backlog

Shared caregivers and pet transfer; offline cache/synchronization; clinic staff accounts/portals; live clinic availability and booking integrations; clinic EMR integrations; verified veterinary records; data export/sharing; online payments; teleconsultations; vaccine schedule recommendations; dose calculators; complex medication recurrence; inventory purchasing/barcodes; automatic medication-to-stock conversion; AI features. Scope these as separate epics after the first-release workflows are validated.

_Source: Notion — PawCare_Backlog_Specifications v1.1 (4 Nov 2026)._
