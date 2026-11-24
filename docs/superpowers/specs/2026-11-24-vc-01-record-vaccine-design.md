# VC-01 — Record an administered vaccine (phone data layer)

Date: 24 Nov 2026 · Status: approved 24 Nov 2026 · Ticket: VC-01 · Branch: `VC-01-record-vaccine`
· Spec: `docs/spec/epics/VC.md` (VC-01), `docs/spec/00-overview.md` (shared requirements)

## Intent

Owners record vaccines their pet received and, when the clinic documented one, the next due date,
so they can see completed and upcoming vaccinations. PawCare never infers a schedule: no due date
entered means none shown. VC-01 is the second record kind on MR-01's `care_records` parent, so it
also proves that pattern generalises. We deliver the on-phone data layer and its contract; the
screens (including "No next date recorded" and the Overdue badge) are `VC-01-APP`.

## Goals

- Migration 0004: `vaccinations` and `vaccine_due_items`, mirroring the PostgreSQL baseline.
- `vaccines.create`, `vaccines.get` and `vaccines.listForPet`, scoped by owner.
- Overdue derived on read in the owner's zone, never stored.
- Two "save anyway?" warnings: a similar entry, and a date before the pet's birth.
- The care-record steps shared by medical events and vaccines live in one place.

## Non-goals

- Closing a due item with a later dose (VC-04), Care Due across pets (VC-04), reminders (RM-02 /
  VC-04; the reminder defaults decision is still open), corrections and voiding (MR-04), the
  timeline (MR-03), attachments (MR-02).

## Anti-goals

- Any inferred interval or schedule, or a vaccine catalogue that "corrects" the name.
- Merging similar entries automatically: the owner decides.
- Storing Overdue.

## Approaches (decided 24 Nov 2026, user accepted the proposals)

| Question | Chosen | Rejected |
| --- | --- | --- |
| Due items | Create `vaccine_due_items` now, including `fulfilled_by_vaccination_id` (empty until VC-04) | A `next_due_on` column (VC-04 would need a table rebuild, D-ERD-3 needs the separate row) |
| Overdue | `nextDue.overdue` computed on read: `due_on` before the owner's local today | Stored flag; leaving it all to screens |
| "Similar" | Same pet, same name ignoring case and surrounding spaces, same administration date, among ACTIVE vaccinations → `confirmSimilar` | Warning on any same name (different dates are normal later doses) |
| Before birth | Reuse MR-01's warning (`confirmBeforeBirth`) on the administration date | No warning (the spec doesn't ask; a pre-birth vaccine is almost surely a typo) |
| Due on the administration date | Allowed; only earlier is blocked | — |

## Design

### `packages/core`

- `normalizeVaccineName`: 1–150 trimmed code points, `Enter a vaccine name of 1–150 characters.`
- `normalizeBatchLabel`: trimmed; blank → `null`; over 100 → `Enter a batch of up to 100 characters.`
- `checkVaccinationDate(value, today)`: `checkPastOrToday` with `The vaccination date can't be in
  the future.`
- `checkNextDueDate(value, administeredOn)`: a real date from 1900 (the same parsing as
  `checkPastOrToday`, factored into a shared `checkDate`), not before `administeredOn`, error
  `The next due date can't be before the vaccination date.` Past due dates are valid.
- Provider reuses MR-01's `normalizeProviderName`.

### Migration `0004-vaccinations`

```sql
CREATE TABLE vaccinations (
  record_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'VACCINE' CHECK (kind = 'VACCINE'),
  vaccine_name TEXT NOT NULL CHECK (length(trim(vaccine_name)) >= 1 AND length(vaccine_name) <= 150),
  administered_on TEXT NOT NULL CHECK (date(administered_on) = administered_on),
  provider_name TEXT CHECK (provider_name IS NULL
    OR (length(trim(provider_name)) >= 1 AND length(provider_name) <= 150)),
  batch_label TEXT CHECK (batch_label IS NULL OR length(batch_label) BETWEEN 1 AND 100),
  UNIQUE (owner_id, pet_id, record_id),
  FOREIGN KEY (owner_id, pet_id, record_id, kind)
    REFERENCES care_records (owner_id, pet_id, id, kind)
);

CREATE TABLE vaccine_due_items (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  vaccination_id TEXT NOT NULL,
  due_on TEXT NOT NULL CHECK (date(due_on) = due_on),
  fulfilled_by_vaccination_id TEXT,
  schedule_version INTEGER NOT NULL DEFAULT 1 CHECK (schedule_version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (owner_id, pet_id, vaccination_id),
  UNIQUE (owner_id, pet_id, fulfilled_by_vaccination_id),
  CHECK (fulfilled_by_vaccination_id IS NULL OR fulfilled_by_vaccination_id <> vaccination_id),
  FOREIGN KEY (owner_id, pet_id, vaccination_id)
    REFERENCES vaccinations (owner_id, pet_id, record_id),
  FOREIGN KEY (owner_id, pet_id, fulfilled_by_vaccination_id)
    REFERENCES vaccinations (owner_id, pet_id, record_id)
);
CREATE INDEX vaccine_due_items_owner_due ON vaccine_due_items (owner_id, due_on);
```

`care_records.occurrence_date` is written equal to `administered_on` (the timeline sorts on the
parent). `TableName` gains `'vaccinations'` and `'vaccine_due_items'`. `change_log` needs no
rebuild: the vaccination is a `'care_record'`, and the due item is logged as its `nextDueOn` field.

### Shared care-record steps (`src/data/care-records/`)

Move out of the medical repository, and use from both: reading the owner's active pet (id, name,
birth date) or `NOT_FOUND`; the owner's local today; inserting the `care_records` parent; the
before-birth warning text (`This date is before {pet name}'s birth date. Save anyway?`).
Behaviour of `medical.*` must not change (its tests stay green untouched).

### Contract (`src/data/index.ts`)

```ts
interface Vaccination {
  id: string; petId: string; vaccineName: string; administeredOn: string;
  providerName: string | null; batchLabel: string | null;
  nextDue: { id: string; dueOn: string; overdue: boolean } | null;
  status: 'ACTIVE' | 'VOIDED'; provenance: 'OWNER_ENTERED';
  voidReason: string | null; voidedAt: string | null;
  version: number; createdAt: string; updatedAt: string;
}
interface CreateVaccinationInput {
  petId: string; vaccineName: string; administeredOn: string;
  providerName?: string; batchLabel?: string; nextDueOn?: string;
  confirmSimilar?: boolean; confirmBeforeBirth?: boolean;
}
```

- `vaccines.create(input)`: shape check → owner's active pet (else `NOT_FOUND`, before any field
  rule) → field rules (one `VALIDATION_FAILED`) → warnings, collected into one
  `CONFIRMATION_REQUIRED` when unconfirmed:
  - `vaccineName`: `You already recorded {name} for {pet name} on this date. Save anyway?`
    (`confirmSimilar`); names compared in JS with `trim().toLowerCase()` against the pet's ACTIVE
    vaccinations on that date.
  - `administeredOn`: the before-birth text (`confirmBeforeBirth`).
  → one `db.write(['care_records', 'vaccinations', 'vaccine_due_items', 'change_log'])`: parent,
  vaccination, the due item when `nextDueOn` is given, and one `change_log` row (`entity_type
  'care_record'`, action `vaccination.created`, field names only, `nextDueOn` included when set).
- `vaccines.get(id)`: owner-scoped, any status, archived pets included; `nextDue.overdue` uses the
  owner's local today at read time.
- `vaccines.listForPet(petId, { limit?, cursor? })`: like `medical.listForPet` — ACTIVE only,
  `administered_on DESC, id DESC`, shared `paging.ts`, cursor scoped to this owner, pet and kind
  `VACCINE`, generic cursor error otherwise.
- `PawCareData` gains `vaccines`; `createVaccineRepository(db, deps, ownerId)`.

### Backlog

VC-01 → In Progress; add `VC-01-APP` (Vaccine screens on the phone data layer, depends on VC-01
and LOCAL-01); MR-01 → Done (merged; MR-01-APP stays open).

## Tests (written first)

Every row of the VC-01 test plan: create with and without a due date (one parent, one
vaccination, zero or one due item, one log row); limits and owner-zone "future"; due date earlier
than administration blocked, equal allowed, past accepted and `overdue: true`, future
`overdue: false`; no inference when absent; several doses on different dates with no warning;
the similar warning (case and spaces ignored), then saved with `confirmSimilar`, never merged;
before-birth warning and `confirmBeforeBirth`; both warnings at once; field errors before
warnings; archived, unknown, malformed and other-owner pet → `NOT_FOUND`; `get` and `listForPet`
isolation and cursors; change log without the name, batch or provider; rollback leaving no rows
in any of the four tables; migration 0004 constraints. `medical.*` tests pass unchanged after the
shared-steps move.

## Left to the builder

File split inside `src/data/vaccines` and `src/data/care-records`; helper names; exact message
copy for the name and batch errors within PF-02's tone.
