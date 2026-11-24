# MR-01 — Record a medical event (phone data layer)

Date: 24 Nov 2026 · Status: approved 24 Nov 2026 · Ticket: MR-01 · Branch: `MR-01-record-medical-event`
· Spec: `docs/spec/epics/MR.md` (MR-01), `docs/spec/00-overview.md` (shared requirements)

## Intent

Owners keep a personal history of each pet's care: visits, diagnoses, procedures, allergies and
notes, always labelled **Owner-entered**. MR-01 is the first health record, so it also lays down
what every later one reuses: the `CARE_RECORDS` parent with exactly one subtype row, and a
warning the owner can override ("save anyway?"). We deliver the on-phone data layer and its
contract; the screens are `MR-01-APP`.

## Goals

- Migration 0003: `care_records` (the shared parent) and `medical_events`, mirroring the
  PostgreSQL baseline; `change_log` rebuilt to accept care records.
- `medical.create`, `medical.get` and `medical.listForPet`, scoped by owner.
- A reusable confirmation pattern: `CONFIRMATION_REQUIRED` plus a `confirm…` flag, first used for
  a date before the pet's birth date.

## Non-goals

- Editing and voiding (MR-04); the timeline across record kinds (MR-03); attachments (MR-02).
- `appointment_id` on `medical_events` (added with AP-05; see Design).
- Vaccine, prescription and appointment subtype tables (their own stories).

## Anti-goals

- Any clinical judgment: no inferred diagnoses, no "verified" wording, no deduplication on title
  and date (identical legitimate events are allowed).
- A future-dated medical event: planned visits belong in Appointments.
- A care record without its subtype row, or a subtype row for another owner's pet.

## Approaches (decided 24 Nov 2026, user accepted the proposals)

| Question | Chosen | Rejected |
| --- | --- | --- |
| Date before birth | `CONFIRMATION_REQUIRED` + `confirmBeforeBirth` flag | A hard error (spec says allow); a silent save (spec says warn) |
| One subtype per record | Enforced in the repository's single transaction, plus tests | A SQLite trigger: SQLite has no deferred triggers, and a subtype can't exist before its parent |
| `appointment_id` | Left out until AP-05 | Column now without its FK (SQLite can't add a composite FK later without a rebuild anyway) |
| Listing | Simple `listForPet` now | Wait for MR-03 (MR-01-APP couldn't show saved records) |
| Future date copy | "A medical event can't be in the future. Add planned visits in Appointments." | — |

The spec's retry criterion (same request ID → at most one event) is API wording. On the phone a
local write commits or throws (CLAUDE.md), so the data layer guarantees one call = one record,
and MR-01-APP prevents double taps.

## Design

### `packages/core`

- `MEDICAL_EVENT_TYPES = ['VISIT', 'DIAGNOSIS', 'PROCEDURE', 'ALLERGY', 'GENERAL_NOTE']`.
- Field rules: title 1–150 trimmed code points (required); notes ≤ 5,000 (empty → null); provider
  1–150 trimmed (empty → null). Reuse `normalizeOptionalText`; the occurrence date uses
  `checkPastOrToday` (real date, 1900 or later, not after the owner's local today).
- `ErrorCode.CONFIRMATION_REQUIRED` (additive; the API keeps building and isn't changed).

### Migration `0003-care-records`

```sql
CREATE TABLE care_records (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('MEDICAL','VACCINE','PRESCRIPTION','APPOINTMENT')),
  occurrence_date TEXT NOT NULL CHECK (date(occurrence_date) = occurrence_date),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VOIDED')),
  provenance TEXT NOT NULL DEFAULT 'OWNER_ENTERED' CHECK (provenance = 'OWNER_ENTERED'),
  void_reason TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (owner_id, id, kind),
  UNIQUE (owner_id, pet_id, id, kind),
  FOREIGN KEY (owner_id, pet_id) REFERENCES pets (owner_id, id),
  CHECK ((status = 'ACTIVE' AND void_reason IS NULL AND voided_at IS NULL)
    OR (status = 'VOIDED' AND voided_at IS NOT NULL AND void_reason IS NOT NULL
      AND length(trim(void_reason)) >= 1 AND length(void_reason) <= 500)),
  CHECK (kind <> 'APPOINTMENT' OR status = 'ACTIVE')
);
CREATE INDEX care_records_owner_pet_date ON care_records (owner_id, pet_id, occurrence_date, id);

CREATE TABLE medical_events (
  record_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'MEDICAL' CHECK (kind = 'MEDICAL'),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('VISIT','DIAGNOSIS','PROCEDURE','ALLERGY','GENERAL_NOTE')),
  title TEXT NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 150),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 5000),
  provider_name TEXT CHECK (provider_name IS NULL
    OR (length(trim(provider_name)) >= 1 AND length(provider_name) <= 150)),
  FOREIGN KEY (owner_id, pet_id, record_id, kind)
    REFERENCES care_records (owner_id, pet_id, id, kind)
);
```

`change_log` is rebuilt so `entity_type` also accepts `'care_record'`: create `change_log_v2`
with the same columns and the wider `CHECK`, copy every row, drop the old table (its triggers go
with it), rename, and recreate the two append-only triggers. Nothing references `change_log`, so
foreign keys are unaffected. `TableName` gains `'care_records'` and `'medical_events'`.

**Known gap, recorded for the server:** PostgreSQL's deferred `care_records_require_subtype`
trigger has no SQLite equivalent. The repository writes parent and subtype in one transaction
and tests prove no parent is left without its subtype; AUTH-01's upload must re-check it.

### Contract (`src/data/index.ts`)

```ts
interface MedicalEvent {
  id: string; petId: string;
  eventType: 'VISIT' | 'DIAGNOSIS' | 'PROCEDURE' | 'ALLERGY' | 'GENERAL_NOTE';
  title: string; occurrenceDate: string; notes: string | null; providerName: string | null;
  status: 'ACTIVE' | 'VOIDED'; provenance: 'OWNER_ENTERED';
  voidReason: string | null; voidedAt: string | null;
  version: number; createdAt: string; updatedAt: string;
}
interface CreateMedicalEventInput {
  petId: string; eventType: MedicalEvent['eventType']; title: string; occurrenceDate: string;
  notes?: string; providerName?: string; confirmBeforeBirth?: boolean;
}
```

- `medical.create(input) → MedicalEvent`: shape check → the pet must be the owner's and active
  (else `NOT_FOUND`, before any field rule) → field rules (one `VALIDATION_FAILED`) → if the date
  is before the pet's birth date (estimated or not) and `confirmBeforeBirth` isn't `true`, throw
  `CONFIRMATION_REQUIRED` with `details: { warnings: { occurrenceDate: ["This date is before
  {pet name}'s birth date. Save anyway?"] } }` → one `db.write(['care_records', 'medical_events',
  'change_log'])` inserting the parent, the subtype and one `change_log` row (`entity_type
  'care_record'`, action `medical_event.created`, field names only).
- `medical.get(id) → MedicalEvent`: owner-scoped, any status, archived pets included (history
  stays readable); unknown, malformed or other-owner → `NOT_FOUND`.
- `medical.listForPet(petId, { limit?, cursor? }) → { data, nextCursor }`: the owner's pet
  (archived allowed), `ACTIVE` records only, `occurrence_date DESC, id DESC`, limit 1–100
  (default 20). The cursor is the last record's ID; the repository reads its date, owner-scoped,
  and pages with `(occurrence_date, id) < (?, ?)`. A bad cursor or limit → field error. MR-03 may
  replace this with the timeline; MR-04 adds voided records.
- `PawCareData` gains `medical`; `createMedicalRepository(db, deps, ownerId)`.

Hard errors win over warnings: a date before birth is only reported once every field is valid.

### Backlog

MR-01 → In Progress; add `MR-01-APP` (Medical event screens on the phone data layer, depends on
MR-01 and LOCAL-01).

## Tests (written first)

Every row of the MR-01 test plan: create with all five types and the field limits; future date
in the owner's zone (17:00 UTC 24 Nov = 25 Nov in Manila); 1900 floor; date-only; one record +
one subtype per call and full rollback when the change log fails; before-birth warning, then
saved with `confirmBeforeBirth`; identical events both saved; archived, unknown, malformed and
other-owner pet → `NOT_FOUND` even with a field error; `get` isolation; `listForPet` order, ties,
paging, archived pet readable, other owner's pet `NOT_FOUND`; change log without health text;
migration 0003 constraints (kinds, status, provenance, void check, `kind = 'MEDICAL'`, composite
FK rejecting another owner's pet or a parent of another kind) and the rebuilt `change_log` (old
rows kept, still append-only, accepts `'care_record'`).

## Left to the builder

File split inside `src/data/medical`; helper names; how the core rules are grouped; exact
validation messages for title, notes and provider (following PF-02's tone).
