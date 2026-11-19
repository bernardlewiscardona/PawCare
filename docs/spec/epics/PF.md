# Epic PF — Pet and owner profiles

### PF-01 — [STORY] Create and edit the owner profile

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a registered owner, I want to maintain my contact details and time zone, so that PawCare can identify me and schedule my care reminders correctly.
- **Acceptance Criteria:**
  - **Given** a verified account, **when** I submit a display name of 1–100 trimmed characters and a valid IANA time zone, **then** my profile is saved and displayed on reopening.
  - **Given** I supply an optional phone number, **when** it is saved, **then** it is normalized to international format or a field error requests a country code and valid number.
  - **Given** I change my profile, **when** I save, **then** immutable account identity and sign-in email remain unchanged; notification time-zone changes follow RM-01.
- **Technical / Design Notes or Dependencies:** Depends on FN-01 and authentication. Fields: account ID, display name, phone, time zone, optional avatar. Email changes require a separate verified account workflow and are excluded here.
- **Edge Cases & Failure Points:** Unicode names; whitespace-only values; invalid zones; network failure; concurrent edits. Do not require an address or phone merely to maintain a diary.

### PF-02 — [STORY] Register a pet

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to create a pet profile, so that I can keep each pet’s information and care history separate.
- **Acceptance Criteria:**
  - **Given** I enter a name of 1–100 trimmed characters and select a species, **when** I save, **then** one pet is created under my account and appears in my pet list.
  - **Given** birth date, breed, sex, weight, microchip, and photo are optional, **when** I leave them blank, **then** registration succeeds and unknown age is displayed as unknown.
  - **Given** a future birth date or non-positive weight, **when** I submit, **then** the invalid field is rejected; a valid weight is stored in kilograms with its measurement date and displayed using the selected unit.
- **Technical / Design Notes or Dependencies:** Depends on FN-01. Species: Dog, Cat, Bird, Rabbit, Other; Other requires a description. Sex: Male, Female, Unknown. Birth date may be marked estimated. Proposed weight range: >0 to 1,000 kg; confirm species coverage during refinement. Photo uses MR-02’s upload controls, restricted to image formats.
- **Edge Cases & Failure Points:** Pets sharing a name are allowed; unknown birth date; very small animals; failed photo upload must not prevent saving a valid profile without a photo. Microchip value is optional and not globally searchable.

### PF-03 — [STORY] Select and edit pet profiles

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a multi-pet owner, I want to switch between and edit my pets, so that care actions are assigned to the correct animal.
- **Acceptance Criteria:**
  - **Given** several active pets, **when** I select one, **then** its name and photo/placeholder appear in the care context and pet-specific screens show only that pet’s data.
  - **Given** an unsaved care form for pet A, **when** I switch to pet B, **then** I must explicitly discard the form or remain on pet A; no record silently changes pet association.
  - **Given** valid profile changes, **when** I save, **then** existing health records remain linked to the same pet ID and the new profile information is displayed.
- **Technical / Design Notes or Dependencies:** Depends on PF-02. Use pet IDs rather than names for associations. Include the pet name on confirmation screens and mutation requests.
- **Edge Cases & Failure Points:** Selected pet archived on another device; no active pets; same-name pets; stale edit conflicts. The empty state offers Add Pet.

### PF-04 — [STORY] Archive and restore a pet

- **Issue Type:** User Story
- **Priority:** Medium
- **User Story:** As an owner, I want to archive a pet without losing its history, so that my active care list stays relevant.
- **Acceptance Criteria:**
  - **Given** no upcoming Planned appointments, **when** I confirm archiving, **then** the pet leaves active selectors, its history remains readable, and pending pet reminders are canceled.
  - **Given** upcoming Planned appointments, **when** I request archiving, **then** the action is blocked and links to those diary entries are shown.
  - **Given** an archived pet, **when** I restore it, **then** it returns to active selectors; previously canceled reminders remain canceled until I explicitly recreate them.
- **Technical / Design Notes or Dependencies:** Depends on PF-02, AP-03, RM-02. Archived history is read-only until restored. Archive does not delete shared household inventory items.
- **Edge Cases & Failure Points:** Appointment created concurrently with archive; retry after success; deceased pets; overdue care on restoration. Serialize appointment/archive state checks.

> Also apply every rule in `docs/spec/00-overview.md` → Shared requirements, and the Definition of Done.
