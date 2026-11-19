# Epic MR — Digital medical records and timeline

### MR-01 — [STORY] Record a medical event

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to record a pet’s medical event, so that I have a reliable personal history of its care.
- **Acceptance Criteria:**
  - **Given** an active pet, **when** I submit event type, title (1–150 characters), occurrence date, and optional notes/provider, **then** the record is saved for that pet and labeled Owner-entered.
  - **Given** the event is a historical medical record, **when** a future occurrence date is supplied, **then** validation rejects it and directs planned visits to Appointments.
  - **Given** a failed save followed by retry with the same request identifier, **when** the server processes it, **then** at most one event is created.
- **Technical / Design Notes or Dependencies:** Depends on PF-02. Types: Visit, Diagnosis, Procedure, Allergy, General Note. Notes maximum 5,000 characters; provider text maximum 150. Date-only precision is valid. Vaccines and prescriptions are separate canonical records surfaced through MR-03.
- **Edge Cases & Failure Points:** Unknown historic details; date before estimated birth; identical legitimate events. Warn on dates before birth but allow explicit confirmation; do not deduplicate on title/date alone.

### MR-02 — [STORY] Attach medical documents

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to attach reports and prescription images, so that I can retrieve the source documents alongside my pet’s records.
- **Acceptance Criteria:**
  - **Given** a saved medical, vaccine, or prescription record, **when** I upload a JPEG, PNG, or PDF no larger than 10 MB, **then** it is linked only after type validation and malware scanning pass; allow up to five files per record.
  - **Given** a file is scanning, rejected, or fails to upload, **when** I view the record, **then** its state and a retry/remove action appear without making an unsafe file downloadable.
  - **Given** I am the record owner, **when** I request preview/download or remove the attachment, **then** access is authorized and removal revokes future access to the file.
- **Technical / Design Notes or Dependencies:** Depends on FN-01, MR-01 and private object storage/scanning. Validate file signatures, not extension alone. Use non-public object keys and authorized downloads; short-lived links must expire within five minutes. Clean abandoned uploads within 24 hours.
- **Edge Cases & Failure Points:** Corrupt PDFs; disguised executables; interrupted transfer; storage outage; deletion during scanning; expired URLs. An issued download link may remain usable until its documented expiry; exclude health details from filenames exposed in logs.

### MR-03 — [STORY] Browse the unified pet health timeline

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want a chronological view of a pet’s recorded care, so that I can quickly understand its health history.
- **Acceptance Criteria:**
  - **Given** medical events, administered vaccines, prescription starts, and appointments marked Completed by the owner, **when** I open the timeline, **then** each appears once with type, date, title, and a link to its canonical detail.
  - **Given** type and inclusive date-range filters, **when** I apply them, **then** only matching entries for the selected pet appear, newest first, with stable pagination and an empty state when none match.
  - **Given** a source record changes or is voided, **when** the timeline reloads, **then** its updated or voided state is shown without creating a second entry.
- **Technical / Design Notes or Dependencies:** Depends on MR-01, VC-01, VC-02, AP-05. Sort by local occurrence date descending, timestamp when available, then stable ID. Date-only entries display no invented time. Planned appointments belong in Upcoming, not completed health history. Prescription end/stop updates its existing entry.
- **Edge Cases & Failure Points:** Same-day events; pagination during inserts; deleted attachment previews; empty history; owner completion does not create or verify clinical findings.

### MR-04 — [STORY] Correct or void a medical event

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to correct or void an inaccurate medical event, so that my diary remains useful without silently losing its history.
- **Acceptance Criteria:**
  - **Given** an editable medical event, **when** I save valid corrections, **then** the event is updated and its modification timestamp and audit metadata are retained.
  - **Given** I confirm Void and enter a reason of 1–500 characters, **when** the action succeeds, **then** the event is marked Voided, excluded from active summaries, and available through Show Voided.
  - **Given** another session changed the record, **when** I submit an older version, **then** a conflict requires reload and review.
- **Technical / Design Notes or Dependencies:** Depends on MR-01, MR-03. Apply the same correction/void behavior to vaccine and prescription records through their own details; voiding their source cancels pending reminders. Historical medication administrations remain identifiable as history.
- **Edge Cases & Failure Points:** Record opened from an old notification; attached files on a voided record; void during reminder dispatch. Voiding is not permanent account deletion.

> Also apply every rule in `docs/spec/00-overview.md` → Shared requirements, and the Definition of Done.
