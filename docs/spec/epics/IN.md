# Epic IN — Household inventory

### IN-01 — [STORY] Register household pet supplies

- **Issue Type:** User Story
- **Priority:** Medium
- **User Story:** As an owner, I want to register my pet supplies and their units, so that I can track what is available at home.
- **Acceptance Criteria:**
  - **Given** a valid item name, category, unit, initial quantity, and optional pet links, **when** I save, **then** the item and opening balance transaction are created atomically under my account.
  - **Given** quantity below zero or a pet belonging to another owner, **when** I submit, **then** saving is rejected.
  - **Given** an item has transactions, **when** I edit it, **then** its name/category/pet links may change but its unit is immutable; changing unit requires a new item.
- **Technical / Design Notes or Dependencies:** Depends on FN-01/PF-02. Categories: Food, Medication, Supplement, Supply. Units: piece, tablet, capsule, sachet, gram, milliliter. Quantities use fixed decimal precision up to three decimal places; discrete units require integers. No automatic pack-to-piece or dose conversion. Names maximum 150 characters.
- **Edge Cases & Failure Points:** Duplicate item names are allowed; shared item across pets; initial zero; precision rounding. Reject excess precision rather than silently rounding.

### IN-02 — [STORY] Add stock and track expiry batches

- **Issue Type:** User Story
- **Priority:** Medium
- **User Story:** As an owner, I want to record restocks by batch and expiry, so that I know which supplies are still usable.
- **Acceptance Criteria:**
  - **Given** an inventory item, **when** I add a positive quantity with optional batch label/expiry date, **then** a new batch and restock transaction increase the balance atomically.
  - **Given** batches with different expiry dates, **when** I view the item, **then** each batch’s remaining balance and expiry status is visible; expired balances are excluded from usable quantity but remain in physical quantity.
  - **Given** an already expired restock, **when** I submit, **then** an explicit confirmation is required and the quantity is recorded as expired, not usable.
- **Technical / Design Notes or Dependencies:** Depends on IN-01. Initial stock is an opening batch, expiry optional. Batches expire at the start of the day after the expiry date in the owner’s configured zone. Unknown expiry is displayed as Unknown and is counted as usable without implying safety verification. Physical quantity is the sum of all remaining batches; usable quantity excludes expired batches.
- **Edge Cases & Failure Points:** Same label with different expiry; no expiry; product returned; date change crossing midnight. Financial purchase/return handling is excluded; use audited quantity adjustments for corrections.

### IN-03 — [STORY] Record use, disposal, and stock corrections

- **Issue Type:** User Story
- **Priority:** Medium
- **User Story:** As an owner, I want to record consumption and corrections, so that inventory quantities reflect actual household supplies.
- **Acceptance Criteria:**
  - **Given** sufficient usable stock, **when** I record a positive consumption quantity, **then** it is deducted atomically from selected non-expired batches or, by default, earliest expiry first; unknown-expiry batches follow dated batches.
  - **Given** expired stock or a count error, **when** I record disposal or a batch adjustment with a reason, **then** a new transaction changes the physical balance without altering previous transactions or creating negative batch stock.
  - **Given** two concurrent consumption requests exceed remaining stock, **when** they commit, **then** only allowable deductions succeed and the rejected request displays the refreshed balance.
  - **Given** I correct an erroneous transaction, **when** I confirm a reversal, **then** a linked compensating entry is created once; if later activity would make that reversal invalid, it is blocked and an explicit count adjustment is required.
- **Technical / Design Notes or Dependencies:** Depends on IN-02. Immutable stock ledger with atomic batch balances; unique request IDs. Explicit optional pet/prescription reference only; logging Taken in VC-03 never invokes this deduction automatically. Disposal can target expired batches; consumption cannot.
- **Edge Cases & Failure Points:** Partial package usage; mismatched medication units; double tap; archived linked pet; reversal of used restock. No negative balance or automatic unit conversion.

### IN-04 — [STORY] Configure low-stock and expiry alerts

- **Issue Type:** User Story
- **Priority:** Medium
- **User Story:** As an owner, I want alerts for low or expiring supplies, so that I can restock or review them before they run out.
- **Acceptance Criteria:**
  - **Given** an item with a nonnegative threshold in its unit, **when** usable quantity reaches or falls below it, **then** the inventory dashboard shows Low stock and creates one alert for that low-stock episode.
  - **Given** a low-stock item is restocked above threshold, **when** it later falls to/below threshold again, **then** a new episode may alert; repeated checks while already low do not create duplicates.
  - **Given** a positive batch balance and a configured expiry lead of 7 or 30 days, **when** the owner-local alert day/time arrives, **then** one upcoming-expiry alert is generated; a batch added inside that window generates one alert at the next scheduler run.
  - **Given** a batch becomes expired or is fully consumed/disposed, **when** the dashboard and scheduler evaluate it, **then** its expired/empty state is accurate, obsolete future alerts are canceled, and no consumption is logged automatically.
- **Technical / Design Notes or Dependencies:** Depends on IN-01–IN-03, RM-02. Expiry alerts are per batch; low-stock alerts per household item. Evaluate low-stock on balance mutations and at least daily for expiry-driven changes. Items may be archived only with zero physical balance; archiving cancels alerts and preserves ledger history. Expired positive batches create one expired-state alert if no such alert exists.
- **Edge Cases & Failure Points:** Zero threshold; unknown expiry (no expiry alerts); threshold edits (re-evaluate, retaining an existing open low-stock episode); timezone/date changes; same item shared by several pets. Send one household alert, not one duplicate per linked pet.

> Also apply every rule in `docs/spec/00-overview.md` → Shared requirements, and the Definition of Done.
