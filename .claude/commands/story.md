---
description: Load a PawCare story with dependencies, open decisions and a test plan
argument-hint: <TICKET-ID e.g. AP-01>
---

Load story **$ARGUMENTS** for PawCare.

1. Find its row in `docs/backlog.csv` and read the full story from the `Spec` file (`docs/spec/epics/<EPIC>.md`).
2. Read the "Shared requirements", "Definition of Ready" and "Definition of Done" sections of `docs/spec/00-overview.md`.
3. For each dependency, give its status from the backlog and one line on the contract this story needs from it.
4. Check `docs/decisions.md` for open decisions or release gates touching this ticket.
5. Find the ticket in the traceability table of `docs/design/erd-and-flows.md`; use those tables, constraints and flowchart as the starting design, and apply any matching item from `docs/design/erd-review.md`.

Then reply with:
- **Summary** — the user story in one sentence
- **Readiness** — Ready / Not ready, with reasons (unmet dependencies, open decisions)
- **Test plan** — one or more test cases per Given/When/Then and per edge case, plus the shared-requirement tests that apply (cross-owner access, idempotent retry, stale version, time zone, etc.)
- **Data sketch** — entities, fields with limits, states and transitions, and the `src/data` repository methods (the API is parked)
- **Questions** — anything ambiguous in the spec

Do not write implementation code in this command.
