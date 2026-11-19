# Epic AP — Owner appointment diary

### AP-01 — [STORY] Record an upcoming pet appointment

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a pet owner, I want to record a visit I arranged outside PawCare, so that I can track its details and receive reminders.
- **Acceptance Criteria:**
  - **Given** an active pet, **when** I submit a title/reason (1–150 characters), clinic/provider name (1–150), future start, positive duration of 1–480 minutes, and IANA time zone, **then** one Planned appointment is saved under my account with optional location, provider contact, and notes.
  - **Given** I am reviewing the form, **when** I save, **then** the interface states “Saved to your diary. Arrange or confirm this visit directly with your clinic”; it never displays a provider booking confirmation or reservation reference.
  - **Given** the same pet has an overlapping Planned visit, **when** I submit, **then** a warning identifies the overlap and explicit Continue is required; no live clinic availability is implied.
  - **Given** a network timeout, **when** I retry the same request, **then** at most one appointment is created and the saved result is returned.
- **Technical / Design Notes or Dependencies:** Depends on FN-01/PF-02. Store owner ID, pet ID, stable internal ID, title, owner-entered provider text, location (maximum 500 characters), optional contact (maximum 200), notes (maximum 2,000), UTC start/end, original IANA zone, status, and version. Optional contact is not a registered provider account. Contact is plain text in v1; no clinic messages are sent. Reminder integration uses RM-02 and can be delivered as a linked subtask.
- **Edge Cases & Failure Points:** Archived pet; nonexistent or ambiguous daylight-saving time; owner traveling; legitimate overlaps; double tap. Reject nonexistent local times; require an offset choice for ambiguous times. Saving cannot reserve a real appointment.

### AP-02 — [STORY] Browse my appointment diary

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a pet owner, I want to browse appointments across my pets, so that I can see upcoming visits and past activity in one place.
- **Acceptance Criteria:**
  - **Given** saved appointments, **when** I open Upcoming, **then** future Planned visits appear soonest first with pet, title, provider text, date/time, and explicit appointment time zone.
  - **Given** a Planned visit whose start has passed, **when** I view Appointments, **then** it appears in Needs Update until I record an outcome; it never automatically becomes Completed.
  - **Given** completed, canceled, or missed visits, **when** I open History, **then** they appear newest appointment date first; pet, status, and inclusive date filters return only matching records with stable pagination.
  - **Given** no results or a load failure, **when** I open a view, **then** an empty state offers Add Appointment or an error offers Retry without showing fabricated data.
- **Technical / Design Notes or Dependencies:** Depends on AP-01. Provide All Pets and individual pet filters. Stable ID breaks same-time sort ties. Detail screen labels the source Owner-entered and shows optional fields only when present. All views use owner authorization.
- **Edge Cases & Failure Points:** Same provider name in different cities; same-name pets; start-time boundary; inaccessible stale deep link; archived pets remain available through history filters.

### AP-03 — [STORY] Edit or reschedule a diary appointment

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a pet owner, I want to update a recorded appointment when my plans change, so that my diary and reminders remain accurate.
- **Acceptance Criteria:**
  - **Given** a Planned visit, including one in Needs Update, **when** I save valid changes, **then** its existing ID is retained and its latest details and audit metadata are shown.
  - **Given** I change the visit time, **when** I save, **then** the replacement time must be in the future, pending old reminders are invalidated, and eligible new reminders use the new time; provider availability is not checked.
  - **Given** I change only notes/provider/location on a past Planned visit, **when** I save, **then** its existing past time is retained and no past reminder is regenerated.
  - **Given** another device has changed its version, **when** I save stale input, **then** I must reload and review rather than overwrite newer details.
- **Technical / Design Notes or Dependencies:** Depends on AP-01/RM-02. Pet association is immutable after creation; correct the wrong pet by canceling the entry and creating another. Same-pet overlaps require the AP-01 warning. No cutoff policy or clinic approval. Show “This updates your diary only. Contact your clinic to arrange the change.” Completed/Canceled/Missed entries are read-only in this release.
- **Edge Cases & Failure Points:** Cancel or complete during edit; stale notification; time zone changed while traveling; response lost after successful edit. Re-read authoritative status before mutation.

### AP-04 — [STORY] Cancel a recorded appointment

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a pet owner, I want to cancel an appointment entry in my diary, so that it no longer appears as upcoming or generates reminders.
- **Acceptance Criteria:**
  - **Given** a Planned visit, **when** I confirm Cancel with an optional reason (maximum 500 characters), **then** it becomes Canceled and its pending reminders are invalidated.
  - **Given** cancellation confirmation, **when** I review it, **then** it states “This cancels the diary entry only. Contact your clinic separately”; no clinic notification or external cancellation is sent.
  - **Given** an already canceled entry, **when** the same request is retried, **then** its canceled result is returned without duplicate actions; Completed or Missed entries reject cancellation with their current status.
- **Technical / Design Notes or Dependencies:** Depends on AP-01/RM-02. Allow cancellation of a Planned entry before or after its start; no 24-hour cutoff. Preserve the entry and reason in History. Use a durable source change/outbox so reminder invalidation is retried, and check source status again at dispatch.
- **Edge Cases & Failure Points:** Reminder already sent; simultaneous outcome/cancel; wrong entry canceled; archived pet. A canceled visit is not reopened in v1; an owner can add a new diary entry. Archived history is read-only.

### AP-05 — [STORY] Record appointment outcomes

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a pet owner, I want to mark a past visit Completed or Missed, so that my diary reflects what actually happened.
- **Acceptance Criteria:**
  - **Given** a Planned visit whose start has passed, **when** I select Completed or Missed and confirm, **then** that outcome, actor, and action time are saved once, and remaining visit reminders are invalidated.
  - **Given** a future visit, **when** I attempt to mark an outcome, **then** the action is blocked until its start; cancellation remains available.
  - **Given** a Completed visit, **when** I open the health timeline, **then** exactly one Owner-entered appointment item links to it; Missed/Canceled visits appear only in appointment History.
  - **Given** a Completed visit, **when** I want to add diagnosis, treatment notes, or documents, **then** I may explicitly create a linked medical event through MR-01; completion alone does not create or verify clinical findings.
- **Technical / Design Notes or Dependencies:** Depends on AP-01 and RM-02 integration; publishes outcomes for the MR-03 timeline consumer. States: Planned → Completed/Canceled/Missed. Terminal entries are read-only in v1; outcome-correction workflow is deferred. MR-03 is a timeline consumer rather than a prerequisite for storing the outcome. Link any explicitly created medical event by appointment ID and label its type so the two distinct items are not mistaken for duplicated appointments.
- **Edge Cases & Failure Points:** Owner forgets to record outcome; completion racing cancellation; retried outcome request; incorrect terminal status. Never infer attendance from elapsed time or notification interaction.

> Also apply every rule in `docs/spec/00-overview.md` → Shared requirements, and the Definition of Done.
