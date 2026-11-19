---
description: Audit current work against a story, the shared requirements and the Definition of Done
argument-hint: <TICKET-ID>
---

Audit the current implementation of **$ARGUMENTS** against the spec. Read the story in `docs/spec/epics/`, plus the Shared requirements and Definition of Done in `docs/spec/00-overview.md`, then inspect the code and tests.

Produce a checklist where each item is ✅ met (cite the test or file), ❌ not met, or ⚠️ partly met / untested:

- Each Given/When/Then acceptance criterion
- Each edge case / failure point
- Shared requirements 1–8 (authorization, validation & idempotency, IDs/pagination/versioning, time handling, UI states & accessibility, encryption/logging/audit, archive semantics, no automatic cross-feature effects)
- Definition of Done items that apply to this story
- Product guardrails from `CLAUDE.md`, including the exact required copy

End with the gaps, ordered by severity. Don't fix anything unless asked.
