# Foundation

### FN-01 — [STORY] Enforce owner access boundaries

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As a pet owner, I want my pet and health information accessible only to authorized users, so that my records remain private.
- **Acceptance Criteria:**
  - **Given** owner A has a pet, **when** owner B requests its profile, child records, files, or reminder endpoints using known IDs, **then** access is denied without revealing the record or whether it exists.
  - **Given** an owner account, **when** it requests another owner’s appointment, inventory, attachment, or nested record using a known ID, **then** access is denied without exposing identifying information.
  - **Given** an expired session, **when** a protected request is submitted, **then** it is rejected and the application requests sign-in without recording the mutation.
- **Technical / Design Notes or Dependencies:** Depends on owner authentication. Sign-in is postponed (decision 2026-11-23): until AUTH-01 adds Google sign-in, a development-only `X-Dev-Owner` header identifies the owner (`AUTH_MODE=dev`, refused in production). The expired-session criterion moves to AUTH-01, and the cross-owner criteria are met per resource as each resource story adds its cross-owner tests (the first landed with PF-02 in `apps/api/test/pets.e2e-spec.ts`) (design: `docs/superpowers/specs/2026-11-23-fn-01-dev-owner-identity-design.md`). Use centralized ownership policies, owner IDs on all owner resources, and short-lived authorized attachment access. Clinic names and contact details are owner-entered text, not accounts or access grants.
- **Edge Cases & Failure Points:** Object ID substitution; access through nested resources; cached responses from a different account; cached screens after logout; lock-screen notification disclosure. Clear local account state on logout.

### FN-02 — [STORY] Request permanent account and data deletion

- **Issue Type:** User Story
- **Priority:** High
- **User Story:** As an owner, I want to delete my account and personal pet data, so that I can stop using PawCare and remove my information.
- **Acceptance Criteria:**
  - **Given** an authenticated owner, **when** they review the deletion impact and successfully reauthenticate and confirm, **then** the account is disabled, sessions are revoked, and an idempotent deletion job is recorded.
  - **Given** deletion is requested, **when** processing runs, **then** reminders are canceled, appointment diary entries and their schedules are removed, and owner data and files are removed or anonymized according to the approved retention policy.
  - **Given** a partial processing failure, **when** the job retries, **then** already completed steps are safe to repeat and the failure is visible to operations until resolved.
- **Technical / Design Notes or Dependencies:** Depends on all resource types and an approved policy covering owner appointment history, backups, audit metadata, and retention exceptions. **Blocked for release until that policy and a measurable completion target are approved.** Deletion UX must disclose any retained categories and reason.
- **Edge Cases & Failure Points:** Active appointments; concurrent data creation; failed attachment deletion; restored backups; no retained contact address for completion email. Prevent writes immediately after account disablement.

> Also apply every rule in `docs/spec/00-overview.md` → Shared requirements, and the Definition of Done.
