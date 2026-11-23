# PF-02 — Register a pet (API)

Date: 23 Nov 2026 · Status: approved 23 Nov 2026 · Ticket: PF-02 (spec: `docs/spec/epics/PF.md`)

## Intent

Owners create a profile for each pet, so care history stays separate per pet. Backend only: the
app developer builds the screens against Swagger, tracked as `PF-02-APP`. This is the first
resource owned through a pet ID, so it also delivers the cross-owner 404 tests FN-01 left to
resource stories.

Decisions confirmed 23 Nov 2026 (`docs/decisions.md`): one weight range for every species
(>0–1,000 kg); kg/lb display unit for body weight, saved as an owner preference; photos deferred
until MR-02; species Dog, Cat, Bird, Rabbit, Other; owner-only release.

## Goals

1. `POST /v1/pets` creates one pet under the current owner, safe to retry with an
   `Idempotency-Key` header.
2. `GET /v1/pets` lists the owner's active pets, paginated; `GET /v1/pets/:id` returns one.
3. Another owner's pet, or an ID that doesn't exist, gives the identical `404 NOT_FOUND`.
4. Weight is stored in kilograms; the API accepts kg or lb; the owner's preferred display unit
   (`weightUnit`) is saved on their profile.

## Non-goals

- Editing pets (PF-03), archiving/restoring (PF-04), photos (after MR-02).
- App screens and age display (the app computes age from `birthDate`; null shows "unknown").
- Searching by microchip (the spec says it isn't globally searchable).

## Anti-goals

- A retried create producing two pets.
- Any response that reveals another owner's pet exists.
- Converting anything except body weight between kg and lb.

## Constraints

- PF-02 acceptance criteria and edge cases: names 1–100 trimmed characters; species required;
  everything else optional; future birth dates and non-positive weights rejected per field;
  pets sharing a name allowed; very small animals; microchip optional and not unique.
- Existing DB CHECKs on `pets` (name, species/species_other, breed ≤100, microchip ≤50,
  weight >0 and ≤1,000, birth-date-estimated needs a birth date, measurement date needs a weight).
- FN-01 ownership rules and PF-01 conventions in `apps/api/AGENTS.md`: `@CurrentOwner()`,
  `details.fields` errors, audit + outbox in the same transaction with field names only.
- Shared requirement 2: creates accept a client request ID; retries create at most one record.
- Shared requirement 3: pagination default 20, max 100, deterministic order with ID tiebreak.

## Approaches considered

| Topic | Options | Chosen |
| --- | --- | --- |
| Retry safety | `Idempotency-Key` header stored in `idempotency_requests` (the table built for this) · client-generated pet ID | **Header + table**: matches the shared requirement and works for every later create |
| List order and paging | By name with a composite cursor · by creation with the pet ID as cursor | **Creation order**: IDs are UUIDv7, so ID order is creation order and one value is the cursor; the app can sort its page by name |
| Weight input | kg only (app converts) · value plus unit | **Value plus unit**: the app sends what the owner typed; the API does the one conversion |

## Design (decided)

**Owner weight unit.** Migration adds `owners.weight_unit` (enum `KG`, `LB`, default `KG`).
`GET /v1/me` and `PATCH /v1/me` gain `weightUnit` (PATCH accepts it like any other field and lists
it in `changedFields`).

**`POST /v1/pets`.** Header `Idempotency-Key` (required, 1–100 characters). Body:

| Field | Rule |
| --- | --- |
| `name` | Required; trimmed; 1–100 code points |
| `species` | Required; `DOG`, `CAT`, `BIRD`, `RABBIT`, `OTHER` |
| `speciesOther` | Required when species is `OTHER` (trimmed, 1–100); rejected otherwise |
| `breed` | Optional; trimmed; 1–100 |
| `sex` | Optional; `MALE`, `FEMALE`, `UNKNOWN` (default `UNKNOWN`) |
| `birthDate` | Optional `YYYY-MM-DD`; not after today in the owner's time zone |
| `birthDateEstimated` | Optional boolean (default false); `true` needs `birthDate` |
| `weight` | Optional `{ value, unit }`, unit `KG` or `LB`; stored in kg rounded to 3 decimals (1 lb = 0.45359237 kg); must be >0 and ≤1,000 kg after conversion |
| `weightMeasuredOn` | Optional `YYYY-MM-DD`, only with `weight`; defaults to today in the owner's zone; not in the future |
| `microchip` | Optional; trimmed; 1–50 letters or digits |

- **201** with the pet. The pet, an audit event (`pet.created`, field names only) and an outbox
  event (`pet.created`, payload `{ petId }`) commit in one transaction, with the
  `idempotency_requests` row.
- **Retries:** the same key and the same body (SHA-256 of the normalised body) returns the
  original pet with **201** and creates nothing. The same key with a different body →
  **409** with a new code `IDEMPOTENCY_KEY_REUSED`. Two requests with the same key at once
  create one pet; the second returns it. Keys expire after 24 hours.
- Missing header → 400 with `details.fields["Idempotency-Key"]`.

**Pet response.** `id`, `name`, `species`, `speciesOther`, `breed`, `sex`, `birthDate`,
`birthDateEstimated`, `currentWeightKg` (number or null), `weightMeasuredOn`, `microchip`,
`version`, `createdAt`. Dates are `YYYY-MM-DD` strings; optional fields are present as `null`.
No photo field yet (added when MR-02 lands).

**`GET /v1/pets`.** Active pets only (`archived_at IS NULL`), oldest first (ID order).
`?limit=` 1–100 (default 20), `?cursor=` the last ID of the previous page. Returns
`{ data: Pet[], nextCursor: string | null }`. A malformed cursor → 400 on `cursor`.

**`GET /v1/pets/:id`.** Looks up by `id` **and** `ownerId`. Not yours, doesn't exist, or not a
UUID → the same `404 NOT_FOUND` "Not found". Archived pets are still returned here (history
stays reachable); PF-04 adds the archive fields.

**Error codes.** Add `IDEMPOTENCY_KEY_REUSED` to `error-codes.ts`. Otherwise reuse
`VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHORIZED`.

## Tests (written first)

- Unit: weight conversion (`{ 9.5, KG }` → 9.5; `{ 22, LB }` → 9.979; `{ 0.002, LB }` → 0.001;
  `{ 0, KG }`, `{ -1, KG }`, `{ 1000.001, KG }`, `{ 2205, LB }` rejected); owner-local "today"
  (a birth date equal to today in `Asia/Manila` is accepted when UTC is still yesterday);
  microchip and name rules.
- e2e: create with only name and species → 201 with every optional field `null`, `sex` `UNKNOWN`;
  full create; `OTHER` without/with `speciesOther`; future birth date, zero weight, estimated
  without date → 400 per field; missing `Idempotency-Key` → 400; same key twice → one pet;
  same key, different body → 409 `IDEMPOTENCY_KEY_REUSED`; two simultaneous same-key creates →
  one pet; list pagination (25 pets → 20 + 5, `nextCursor` null at the end) and archived pets
  excluded; two pets with the same name allowed; audit and outbox rows hold no names;
  `PATCH /v1/me` with `weightUnit: 'LB'` round-trips.
- Cross-owner (FN-01 requirement): owner B's `GET /v1/pets/:id` for owner A's pet gets a body
  identical to a random UUID's 404; owner B's list never includes owner A's pets.

## Docs and backlog

PF-02 → In Review; add `PF-02-APP`; README example; FN-01 note that its first cross-owner tests
landed with PF-02; CLAUDE.md guardrail wording: body-weight kg/lb display is allowed (decision
23 Nov 2026), dose and clinical unit conversion is not.

## Calls made while writing this up

- `Idempotency-Key` is required (not optional), so the guarantee always holds.
- A repeated request with the same key returns 201 (not 200), so the app handles one success path.
- Invalid UUID in the path → 404, not 400, so the response never hints at ID formats.
- Pet list excludes archived pets now, ahead of PF-04, because archived pets must stay out of
  active selectors.

## Left to the builder

Module layout (`src/pets`), where the idempotency logic lives (a reusable service is expected,
since every create needs it), DTO structure, and the payload normalisation used for the hash.
