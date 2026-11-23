# ERD & flows — review against spec v1.1

Reviewed 19 Nov 2026. Overall the design matches the spec closely: owner scoping, archive/void, the explicit vaccine fulfillment, inventory ledger, reminder versioning and dedup keys, and every product guardrail all line up. The items below are gaps or conflicts to settle in refinement. Each one names the ticket it affects.

## Status (2026-11-23)

The first migration (`apps/api/prisma/migrations/*_erd_schema`, branch `SETUP-01_Migrations`) applies these items:

- **Resolved in the schema:** 1 (`follows_owner_zone`), 3 (unique fulfillment), 4 (UUIDv7), 5 (attachment row created at upload start; `scan_status` covers the upload states; `file_assets.created_at`), 6 (at most one non-invalidated dose per prescription and instant), 7 (`stock_transactions.owner_id` and UNIQUE(owner_id, request_key)), 10 (`appointments.outcome_actor_id`), 12 (same-owner, same-pet FK; the Completed-only rule stays in the API), 14 (partial unique indexes), 15 (`owner_id` on every reminder table).
- **Left to the application:** 8 (the delayed marker is derived from `available_at - trigger_at_utc`), 11 (update `occurrence_date` when rescheduling), the Completed-only part of 12, and the flow fixes 9 and 16–18.
- **Still open:** 2 (D-ERD-2) and 13 (no display unit for weight is stored).

## Conflicts with the spec (need a decision)

1. **Medication reminders when the owner changes time zone (RM-01 vs VC-02).** RM-01 says that after a time-zone change, future *owner-local medication* occurrences are regenerated in the new zone. VC-02 and the ERD give each prescription its own `time_zone`, and the ERD says prescription times follow that zone. So with the ERD, a time-zone change would leave medication reminders where they are, which contradicts RM-01. Decide whether prescription zone follows owner zone (a flag like `follows_owner_zone`) or stays fixed. → `docs/decisions.md` D-ERD-1
2. **Archiving with past Planned ("Needs Update") appointments (PF-04, AP-05).** Archive is only blocked by *upcoming* Planned visits, and archived history is read-only. A pet archived with a Needs Update visit leaves that visit stuck in Planned, and its outcome can't be recorded. Either block on any Planned visit, or allow outcome recording on archived pets. → D-ERD-2
3. **Vaccine fulfillment cardinality (VC-04).** `VACCINE_DUE_ITEMS.fulfilled_by_vaccination_id` is a single FK. Yet the constraint text says voiding the fulfilling vaccination reopens the item "unless another valid fulfillment was explicitly recorded", which needs more than one fulfillment per item. Also, VC-04 describes one administration fulfilling *the* prior due item (singular), but the ERD allows many. Pick one-to-one (recommended: unique `fulfilled_by_vaccination_id`) or add a fulfillment join table. → D-ERD-3

## Gaps that affect correctness

4. **Sequential `bigInt` IDs leak counts (FN-01, shared requirement 1).** Exposed sequential IDs reveal record counts and growth, and make ID enumeration easy. The intro also says "UUID … logical types", and audit and outbox already use `uuid`, so it's inconsistent. Recommendation: use UUIDv7 (or a separate public UUID) for every API-exposed ID.
5. **Attachment state before scanning finishes (MR-02).** Rows are only created in ATTACHMENTS after the scan passes ("attach authorized clean asset"). But MR-02 says that while a file is *scanning, rejected, or failed*, the record shows its state with retry/remove. Nothing links a pending asset to its record until then. Add `target_record_id` on FILE_ASSETS, or create the ATTACHMENTS row upfront with a state. Then count pending files toward the limit of 5. `scan_status` also needs to cover upload states (PENDING_UPLOAD, SCANNING, CLEAN, REJECTED, FAILED). The 24h abandoned-upload cleanup needs `created_at` on that row.
6. **Duplicate doses across schedule versions (VC-03).** UNIQUE(prescription_id, schedule_version, scheduled_at_utc) allows the same instant to exist under both v1 and v2. If v1 was already logged Taken, v2 can create a second, unlogged occurrence at the same time. Regeneration must keep logged occurrences and skip instants that already have a log.
7. **Inventory idempotency key (IN-01–IN-03).** `STOCK_TRANSACTIONS.request_id` is a global `bigInt` UK. Client request keys are usually strings or UUIDs and should be scoped per owner, as IDEMPOTENCY_REQUESTS already does. Either drop it in favour of IDEMPOTENCY_REQUESTS or make it `(owner_id, request_key)`. STOCK_TRANSACTIONS also lacks `owner_id`, which composite same-owner FKs need.
8. **Reminder dispatch flow is missing the failed-recheck branch (RM-02).** Flowchart 10, node H, says "Recheck source; expose in-app reminder" but has no branch for when the recheck fails. It should route to "Cancel/suppress". The outage path (≤24h late, labelled *delayed*) and "skip past triggers for newly created overdue sources" appear only in prose. A *delayed* marker isn't modelled either: add `delayed boolean` or derive it from `available_at - trigger_at_utc`.
9. **Onboarding skips the owner profile (PF-01, RM-01).** The main journey goes from sign-in straight to "Create pet". Display name and **time zone** (PF-01) are needed before any owner-local reminder can be scheduled. Add an owner-profile step, or default the time zone from the device and confirm it.

## Smaller items

10. **AP-05** needs the outcome *actor* stored. The ERD only has `outcome_recorded_at`. Single-owner makes this implicit, but the AC says actor is saved: add `outcome_actor_id` or point to AUDIT_EVENTS explicitly.
11. **AP-03:** when an appointment is rescheduled, `CARE_RECORDS.occurrence_date` (the local start date) must be updated in the same transaction.
12. **MR / AP-05:** `MEDICAL_EVENTS.appointment_id` needs a same-owner + same-pet constraint and should only reference a Completed appointment.
13. **PF-02:** the weight is stored in kg, but the "selected display unit" isn't stored anywhere (owner preference?).
14. **IN-04:** spell out the partial unique indexes: one open LOW_STOCK episode per item (`WHERE type='LOW_STOCK' AND resolved_at IS NULL`), and UNIQUE(batch_id, type) for EXPIRING/EXPIRED.
15. **RM-04:** REMINDER_OCCURRENCES has no `owner_id`, so the inbox query and authorization must join through schedules. Denormalize it for indexing and the composite-FK check.
16. **IN-02/IN-03 flow:** flowchart 11 leaves out three things. An *already-expired restock* needs an explicit confirmation step. *Reversal* is an action. Consumption uses default earliest-expiry allocation when no batch is chosen.
17. **AP flow:** flowchart 8 doesn't show the Needs Update state, the stale-version conflict branch, the overlap warning on reschedule, or that Cancel is allowed after start.
18. **Flow 7:** reminders should be scheduled through the outbox in the save transaction, not after the view refresh. Medical events never generate reminders, so the final node applies only to vaccine/prescription.
19. ~~**SETUP-01** is missing from the backlog.~~ Resolved: it's now in `docs/backlog.csv` and `docs/spec/epics/SETUP.md`. The stack (Prisma + PostgreSQL) is still unconfirmed. With Prisma, the CHECK constraints, partial unique indexes and composite same-owner FKs in this design need hand-written SQL in migrations.
