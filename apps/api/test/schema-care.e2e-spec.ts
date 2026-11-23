/**
 * ERD section 2 — vaccines, prescriptions and the appointment diary (VC-01–VC-04, AP-01–AP-05).
 */
import {
  PgError,
  closePool,
  createCareRecord,
  createInventoryItem,
  createOwner,
  createPet,
  expectViolation,
  inRolledBackTx,
  insert,
  type Db,
} from './db/db-test-helpers.js';

afterAll(async () => {
  await closePool();
});

async function ownerWithPet(db: Db) {
  const owner = await createOwner(db);
  const pet = await createPet(db, owner.id);
  return { owner, pet };
}

describe('vaccinations', () => {
  it('requires a 1–150 character vaccine name', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      await expectViolation(
        db,
        () => createCareRecord(db, 'VACCINE', owner.id, pet.id, { vaccine_name: 'x'.repeat(151) }),
        { code: PgError.CHECK, constraint: 'vaccinations_vaccine_name_check' },
      );
    }));
});

describe('vaccine_due_items', () => {
  async function setup(db: Db) {
    const { owner, pet } = await ownerWithPet(db);
    const first = await createCareRecord(db, 'VACCINE', owner.id, pet.id);
    const second = await createCareRecord(db, 'VACCINE', owner.id, pet.id, {
      administered_on: '2027-10-01',
    });
    const due = (vaccinationId: string, extra = {}) =>
      insert(db, 'vaccine_due_items', {
        owner_id: owner.id,
        pet_id: pet.id,
        vaccination_id: vaccinationId,
        due_on: '2027-10-01',
        ...extra,
      });
    return { owner, pet, first, second, due };
  }

  it('allows one next-due item per administration', () =>
    inRolledBackTx(async (db) => {
      const { first, due } = await setup(db);
      await due(first.id);
      await expectViolation(db, () => due(first.id), {
        code: PgError.UNIQUE,
        constraint: /vaccination_id/,
      });
    }));

  it('cannot be fulfilled by its own administration', () =>
    inRolledBackTx(async (db) => {
      const { first, due } = await setup(db);
      await expectViolation(db, () => due(first.id, { fulfilled_by_vaccination_id: first.id }), {
        code: PgError.CHECK,
        constraint: 'vaccine_due_items_fulfilled_by_other_check',
      });
    }));

  it('lets one administration fulfil at most one due item (D-ERD-3)', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet, first, second, due } = await setup(db);
      const third = await createCareRecord(db, 'VACCINE', owner.id, pet.id);
      await due(first.id, { fulfilled_by_vaccination_id: second.id });
      await expectViolation(db, () => due(third.id, { fulfilled_by_vaccination_id: second.id }), {
        code: PgError.UNIQUE,
        constraint: /fulfilled_by_vaccination_id/,
      });
    }));

  it("is fulfilled only by the same pet's vaccination", () =>
    inRolledBackTx(async (db) => {
      const { owner, first, due } = await setup(db);
      const otherPet = await createPet(db, owner.id);
      const otherPetsShot = await createCareRecord(db, 'VACCINE', owner.id, otherPet.id);
      await expectViolation(
        db,
        () => due(first.id, { fulfilled_by_vaccination_id: otherPetsShot.id }),
        { code: PgError.FOREIGN_KEY, constraint: /fulfilled_by_vaccination_id/ },
      );
    }));
});

describe('prescriptions', () => {
  it('requires starts_on on or before ends_on (end date inclusive)', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      await expectViolation(
        db,
        () =>
          createCareRecord(db, 'PRESCRIPTION', owner.id, pet.id, {
            starts_on: '2026-10-02',
            ends_on: '2026-10-01',
          }),
        { code: PgError.CHECK, constraint: 'prescriptions_date_range_check' },
      );
      await createCareRecord(db, 'PRESCRIPTION', owner.id, pet.id, {
        starts_on: '2026-10-01',
        ends_on: '2026-10-01',
      });
    }));

  it('follows the owner time zone by default (D-ERD-1)', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const rx = await createCareRecord(db, 'PRESCRIPTION', owner.id, pet.id);
      expect(rx.subtype).toMatchObject({ follows_owner_zone: true, schedule_version: 1 });
    }));

  it('limits dose instructions to 1–2,000 characters', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      await expectViolation(
        db,
        () =>
          createCareRecord(db, 'PRESCRIPTION', owner.id, pet.id, {
            dose_instructions: 'x'.repeat(2001),
          }),
        { code: PgError.CHECK, constraint: 'prescriptions_dose_instructions_check' },
      );
    }));

  it("links only to the same owner's inventory item", () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const stranger = await createOwner(db);
      const strangersItem = await createInventoryItem(db, stranger.id);
      await expectViolation(
        db,
        () =>
          createCareRecord(db, 'PRESCRIPTION', owner.id, pet.id, {
            inventory_item_id: strangersItem.id,
          }),
        { code: PgError.FOREIGN_KEY, constraint: /inventory_item_id/ },
      );
    }));
});

describe('prescription_times', () => {
  it('keeps each local time unique within a prescription', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const rx = await createCareRecord(db, 'PRESCRIPTION', owner.id, pet.id);
      const addTime = () =>
        insert(db, 'prescription_times', {
          owner_id: owner.id,
          prescription_id: rx.id,
          local_time: '08:00',
        });
      await addTime();
      await expectViolation(db, addTime, { code: PgError.UNIQUE, constraint: /local_time/ });
    }));
});

describe('dose_occurrences and dose_logs', () => {
  async function setup(db: Db) {
    const { owner, pet } = await ownerWithPet(db);
    const rx = await createCareRecord(db, 'PRESCRIPTION', owner.id, pet.id);
    const occurrence = (version: number, at = '2026-10-02T07:00:00Z') =>
      insert(db, 'dose_occurrences', {
        owner_id: owner.id,
        prescription_id: rx.id,
        schedule_version: version,
        scheduled_at_utc: at,
      });
    return { owner, rx, occurrence };
  }

  it('never generates the same dose twice for a schedule version', () =>
    inRolledBackTx(async (db) => {
      const { occurrence } = await setup(db);
      await occurrence(1);
      await expectViolation(db, () => occurrence(1), {
        code: PgError.UNIQUE,
        constraint: /schedule_version_scheduled_at_utc/,
      });
    }));

  it('keeps one valid dose per instant across schedule versions', () =>
    inRolledBackTx(async (db) => {
      const { occurrence } = await setup(db);
      const v1 = await occurrence(1);
      await expectViolation(db, () => occurrence(2), {
        code: PgError.UNIQUE,
        constraint: 'dose_occurrences_one_valid_per_instant_key',
      });
      await db.query('UPDATE dose_occurrences SET invalidated_at = now() WHERE id = $1', [v1.id]);
      await occurrence(2);
    }));

  it('records at most one current result per dose', () =>
    inRolledBackTx(async (db) => {
      const { owner, occurrence } = await setup(db);
      const dose = await occurrence(1);
      const log = (status: string) =>
        insert(db, 'dose_logs', {
          owner_id: owner.id,
          dose_occurrence_id: dose.id,
          status,
          acted_at: '2026-10-02T07:05:00Z',
          actor_owner_id: owner.id,
        });
      await log('TAKEN');
      await expectViolation(db, () => log('SKIPPED'), {
        code: PgError.UNIQUE,
        constraint: /dose_occurrence_id/,
      });
    }));

  it("cannot attach a dose to another owner's prescription", () =>
    inRolledBackTx(async (db) => {
      const { rx } = await setup(db);
      const stranger = await createOwner(db);
      await expectViolation(
        db,
        () =>
          insert(db, 'dose_occurrences', {
            owner_id: stranger.id,
            prescription_id: rx.id,
            schedule_version: 1,
            scheduled_at_utc: '2026-10-02T07:00:00Z',
          }),
        { code: PgError.FOREIGN_KEY },
      );
    }));
});

describe('appointments', () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 11, 1, 10, minutes)).toISOString();

  it('lasts between 1 and 480 minutes', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      for (const minutes of [0, 481]) {
        await expectViolation(
          db,
          () =>
            createCareRecord(db, 'APPOINTMENT', owner.id, pet.id, {
              starts_at_utc: at(0),
              ends_at_utc: at(minutes),
            }),
          { code: PgError.CHECK, constraint: 'appointments_duration_check' },
        );
      }
      await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id, {
        starts_at_utc: at(0),
        ends_at_utc: at(480),
      });
    }));

  it('starts Planned and requires title and provider', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const visit = await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id);
      expect(visit.subtype.status).toBe('PLANNED');
      await expectViolation(
        db,
        () => createCareRecord(db, 'APPOINTMENT', owner.id, pet.id, { provider_name: ' ' }),
        { code: PgError.CHECK, constraint: 'appointments_provider_name_check' },
      );
    }));

  it('stores who recorded an outcome and when (AP-05)', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const visit = await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id);
      await expectViolation(
        db,
        () =>
          db.query("UPDATE appointments SET status = 'COMPLETED' WHERE record_id = $1", [visit.id]),
        { code: PgError.CHECK, constraint: 'appointments_outcome_check' },
      );
      await db.query(
        "UPDATE appointments SET status = 'MISSED', outcome_recorded_at = now(), outcome_actor_id = $1 WHERE record_id = $2",
        [owner.id, visit.id],
      );
    }));

  it('keeps a cancel reason only on canceled visits, at most 500 characters', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      await expectViolation(
        db,
        () => createCareRecord(db, 'APPOINTMENT', owner.id, pet.id, { cancel_reason: 'Moved' }),
        { code: PgError.CHECK, constraint: 'appointments_cancel_reason_check' },
      );
      await expectViolation(
        db,
        () =>
          createCareRecord(db, 'APPOINTMENT', owner.id, pet.id, {
            status: 'CANCELED',
            cancel_reason: 'x'.repeat(501),
          }),
        { code: PgError.CHECK, constraint: 'appointments_cancel_reason_check' },
      );
      await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id, { status: 'CANCELED' });
    }));
});
