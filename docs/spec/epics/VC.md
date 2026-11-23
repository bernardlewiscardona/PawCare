# Epic VC — Vaccines and prescriptions

### VC-01 — [STORY] Record an administered vaccine

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to record a vaccine and its documented next due date, so that I can track completed and upcoming vaccination care.
- **Acceptance Criteria:**
  - **Given** an active pet, **when** I submit vaccine name (1–150 characters), administration date not in the future, and optional provider/batch/next due date, **then** an owner-entered vaccine record appears in its history.
  - **Given** a next due date, **when** it is earlier than the administration date, **then** saving is blocked; a past next due date is accepted and marked Overdue.
  - **Given** no next due date was supplied, **when** I view the record, **then** it shows No next date recorded and no schedule is inferred.
- **Technical / Design Notes or Dependencies:** Depends on PF-02, MR-03. Store administration and due dates as date-only. Product does not infer clinical intervals. Support attachments through MR-02 and corrections through MR-04.
- **Edge Cases & Failure Points:** Multiple doses with the same name; imported historical dates; uncertain vaccine name. Similar entries may warn but cannot be automatically merged.

### VC-02 — [STORY] Record a prescription and owner-entered schedule

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to transcribe a prescription and care schedule, so that I can follow the instructions provided by my veterinarian.
- **Acceptance Criteria:**
  - **Given** an active pet, **when** I submit medication name, dose instruction text, start date, and optional prescriber/end date, **then** the owner-entered prescription is saved without calculated dosing advice.
  - **Given** I enable scheduled reminders, **when** I enter one or more daily local times, **then** the schedule is stored in my owner time zone and follows it when I change zone (RM-01); an As needed prescription creates no recurring reminders.
  - **Given** an end date before the start date, blank required instructions, or duplicate daily times, **when** I save, **then** field validation prevents submission.
- **Technical / Design Notes or Dependencies:** Depends on PF-02; RM-01/RM-02 for alerts. Medication name maximum 150 characters, instructions 2,000; schedule supports fixed daily times only in v1. Other clinical schedules may be recorded as text with manual reminders. Optional inventory link must use an item owned by the same account and never implies dose/unit conversion. Prescription times follow the owner time zone by default (D-ERD-1): the record stores `follows_owner_zone` (default true) and the effective `time_zone` used to generate doses.
- **Edge Cases & Failure Points:** Tapers, alternate-day dosing, unknown end date, time-zone travel. Unsupported schedules must be clearly labeled manual rather than inaccurately converted to daily dosing.

### VC-03 — [STORY] Log a medication dose and stop a prescription

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to mark a scheduled dose Taken or Skipped and stop finished treatment, so that I can track what actually happened.
- **Acceptance Criteria:**
  - **Given** a dose occurrence, **when** I mark Taken or Skipped, **then** one status is stored with its occurrence, actor, action time, and optional note; repeated taps do not create multiple logs.
  - **Given** I correct a dose status, **when** the change is confirmed, **then** the current result and an audit entry reflect the correction; no inventory quantity changes automatically.
  - **Given** an active prescription, **when** I confirm Stop with an effective date/time no later than now, **then** future dose occurrences and reminders are canceled while past logs remain visible.
- **Technical / Design Notes or Dependencies:** Depends on VC-02, RM-02. Prescription states: Planned, Active, Ended, Stopped, Voided; derive active/ended from dates unless explicitly stopped/voided. Notifications alone cannot prove ingestion. Historical logs remain readable for ended prescriptions; new dose logs are blocked for voided prescriptions.
- **Edge Cases & Failure Points:** Dose logged twice on different devices; early stop concurrent with dispatch; skipped dose changed later; notification tap after stop. Show current state before allowing an action.

### VC-04 — [STORY] Review upcoming and overdue care

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to see upcoming and overdue vaccines and doses across my pets, so that I can prioritize care.
- **Acceptance Criteria:**
  - **Given** active pets with due vaccines and scheduled doses, **when** I open Care Due, **then** overdue items appear first, followed by items due today and in the next 30 days, with pet and source links.
  - **Given** a vaccine due date before today, **when** I view it, **then** it is Overdue; a dose becomes Overdue only after its scheduled instant and only while neither Taken nor Skipped.
  - **Given** I record the next vaccine administration, **when** I explicitly select the prior due item it fulfills, **then** that due item closes without deleting the prior vaccine record; saving the new administration and closure is atomic.
- **Technical / Design Notes or Dependencies:** Depends on VC-01–VC-03, RM-02. A same-name vaccine alone does not close another due item. One administration fulfills at most one due item (D-ERD-3). Exclude archived pets, voided records, stopped future doses, and fulfilled vaccine due items.
- **Edge Cases & Failure Points:** Multiple schedules for the same vaccine; date boundary in owner zone; no future due date; correction/void of a fulfilling administration must reopen the prior item in the same transaction, then regenerate only future alerts.

> Also apply every rule in `docs/spec/00-overview.md` → Shared requirements, and the Definition of Done.
