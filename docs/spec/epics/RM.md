# Epic RM — Reminders

### RM-01 — [STORY] Set reminder preferences and device permissions

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to control reminder settings, so that PawCare alerts me at useful times through permitted channels.
- **Acceptance Criteria:**
  - **Given** notification permission is undecided, **when** I opt into push alerts, **then** the OS permission prompt is shown; denial leaves in-app reminders usable and offers an OS-settings link.
  - **Given** valid preferences, **when** I set owner time zone, appointment lead time (24 hours or 1 hour), vaccine lead time (7 days or 1 day), and date-only delivery time (default 09:00), **then** settings are persisted.
  - **Given** I change time zone, **when** I confirm the schedule preview, **then** future owner-local medication and date-only occurrences are regenerated in the new zone; recorded appointment instants remain unchanged.
- **Technical / Design Notes or Dependencies:** Depends on PF-01 and device token registration. Channels: in-app always; push optional. Lock-screen payload defaults to generic text such as You have a PawCare reminder. Quiet hours, SMS, and email alerts are deferred. Medication times come from VC-02, not global defaults.
- **Edge Cases & Failure Points:** OS permission revoked outside app; expired device token; multiple devices; zone changes during travel; daylight-saving gap shifts to next valid time, repeated local time creates one occurrence at its first instant. Display these rules in the time-zone change preview.

### RM-02 — [STORY] Generate and deliver source-based reminders

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want reminders linked to care records, so that important dates generate alerts without repeated manual setup.
- **Acceptance Criteria:**
  - **Given** an unfulfilled vaccine due date, active prescription schedule, Planned appointment, or eligible inventory alert, **when** its trigger is reached, **then** one in-app reminder is created per source occurrence and push is attempted if enabled.
  - **Given** a source is edited, fulfilled, stopped, archived, or canceled, **when** future scheduling runs, **then** obsolete pending occurrences are invalidated and only eligible new ones remain.
  - **Given** a provider timeout or worker retry, **when** delivery is retried, **then** the in-app occurrence is not duplicated; transient push failures retry after 1, 5, and 15 minutes, then are marked failed.
  - **Given** a reminder references an invalidated source, **when** dispatch or deep-link action runs, **then** current source eligibility is checked and obsolete actions are suppressed.
- **Technical / Design Notes or Dependencies:** Depends on source stories, durable scheduler/queue, outbox, and push provider. Unique key: owner + source type/ID + schedule version + occurrence + channel. Appointment trigger is start minus chosen lead; vaccine trigger is due minus lead at owner date-only time; medication trigger is each scheduled instant. Scheduler checks at least every minute; target in-app availability within two minutes of a due trigger under normal service conditions. Push receipt is not guaranteed.
- **Edge Cases & Failure Points:** Provider accepts request but response is lost (OS push duplicates may still occur); queue outage; source changed during send. For newly created/edited overdue sources, show overdue state but skip past triggers. After an outage, send only still-actionable occurrences at most 24 hours late and label them delayed; suppress the rest and retain the audit result. Never send a dose reminder after the next dose is due or an appointment reminder after its start.

### RM-03 — [STORY] Create and manage a custom reminder

- **Issue Type:** User Story
- **Priority:** Medium
- **User Story:** As an owner, I want to schedule a personal pet-care reminder, so that I can track tasks outside medical records.
- **Acceptance Criteria:**
  - **Given** an active pet, **when** I submit a title of 1–150 characters, future local date/time, time zone, and recurrence of None or Daily, **then** the reminder is saved with the next trigger preview.
  - **Given** an active custom reminder, **when** I edit its future time or disable it, **then** pending occurrences are regenerated or canceled without altering past occurrences.
  - **Given** an invalid/past time, **when** I submit, **then** a field error prevents scheduling; daily schedules may optionally end on a date no earlier than their start date.
- **Technical / Design Notes or Dependencies:** Depends on PF-02, RM-01/RM-02. Custom reminders use the same timezone and duplicate prevention rules. No weekly/monthly recurrence in v1; changing a custom reminder affects future occurrences only.
- **Edge Cases & Failure Points:** Pet archive; end date in another zone; edit during dispatch; disabled reminder with an open notification. Validate source state again when opened.

### RM-04 — [STORY] Review and act on reminder occurrences

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want a reminder inbox with relevant actions, so that I can follow up even when push notifications are missed.
- **Acceptance Criteria:**
  - **Given** reminder occurrences, **when** I open the inbox, **then** newest-first items show pet, trigger time, read state, and source; tapping opens the currently authorized source and marks the reminder read.
  - **Given** an actionable occurrence, **when** I snooze it for 15 minutes, **then** one follow-up is scheduled only if the source remains eligible; snoozing does not mark care complete.
  - **Given** a custom task, **when** I mark its occurrence Done, **then** only that occurrence completes; medication actions use VC-03, vaccines use VC-04, and appointments use AP workflows.
  - **Given** a deleted/archived/unavailable source, **when** I open an old notification, **then** a clear unavailable state appears without performing the original action.
- **Technical / Design Notes or Dependencies:** Depends on RM-02/RM-03. Read/unread is independent of task completion. Source reminders without a completion action may be dismissed from inbox without changing care status. A snooze is invalid if it would occur after appointment start or next medication dose.
- **Edge Cases & Failure Points:** Repeated snooze taps; device clock wrong; unread badge mismatch; actions from multiple devices. Server time and occurrence IDs are authoritative; inbox deduplicates push-triggered opens.

> Also apply every rule in `docs/spec/00-overview.md` → Shared requirements, and the Definition of Done.
