## Ticket

<!-- e.g. PF-02. Link the spec section: docs/spec/epics/<EPIC>.md -->

## What changed

## Checklist

- [ ] Every Given/When/Then and listed edge case has a test
- [ ] Shared requirements checked (owner authorization, idempotent retry, version conflicts, time zones, UI states, no sensitive logging)
- [ ] Product guardrails respected (no clinical inference, no implied clinic contact, reminders never act on their own)
- [ ] New env vars added to the right `.env.example`
- [ ] New migration reviewed (and hand-written constraints included where Prisma can't express them)
- [ ] API change is backward compatible for released app versions
- [ ] `docs/backlog.csv` status updated
