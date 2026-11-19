---
description: Test-first implementation of one PawCare story
argument-hint: <TICKET-ID>
---

Implement story **$ARGUMENTS**.

1. Run the `/story $ARGUMENTS` analysis first. If the story isn't Ready (unmet dependencies, open decision, release gate), stop and report what's blocking it.
2. Write failing tests first: every acceptance criterion, every listed edge case, and the applicable shared requirements — at minimum cross-owner access denial, idempotent retry with a request ID, and stale-version conflict for edits.
3. Implement the smallest change that makes them pass: migration, model/constraints, service, API with server validation, and mobile states (loading, empty, error, retry, field errors that keep user input).
4. Respect the product guardrails in `CLAUDE.md` — no clinical inference, no implied clinic contact, no automatic side effects from reminders, archive/void instead of delete. Use the exact user-facing copy the story specifies.
5. Run the full test suite and lint.
6. Run `/spec-check $ARGUMENTS`, and ask the `spec-reviewer` agent to review the diff.
7. Set the story's Status in `docs/backlog.csv` to `In Review` (not `Done` — Done requires QA and product review). If an integration adapter is still missing, note the follow-up subtask.
