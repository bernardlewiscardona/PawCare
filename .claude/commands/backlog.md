---
description: Show PawCare backlog status and what's ready to start next
argument-hint: "[epic code, status, or blank]"
---

Read `docs/backlog.csv` and `docs/decisions.md`. Filter: `$ARGUMENTS` (an epic code like `RM`, a status like `In Progress`, or blank for everything).

Show a compact table: Ticket ID, Title, Priority, Status, Dependencies — grouped by epic.

Then list **Ready to start next**: stories whose status is `Proposed` or `Ready`, whose dependencies are all `Done`, and that have no open decision or release gate. Order them by the delivery sequence in `CLAUDE.md`, then by priority.
