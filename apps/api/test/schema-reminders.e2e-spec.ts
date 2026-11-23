/**
 * ERD section 4 — reminders and delivery (RM-01–RM-04 and the source integrations).
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
  unique,
  type Db,
  type Row,
} from './db/db-test-helpers.js';

afterAll(async () => {
  await closePool();
});

async function ownerWithPet(db: Db) {
  const owner = await createOwner(db);
  const pet = await createPet(db, owner.id);
  return { owner, pet };
}

function customReminder(db: Db, owner: Row, pet: Row, extra: Row = {}) {
  return insert(db, 'custom_reminders', {
    owner_id: owner.id,
    pet_id: pet.id,
    title: 'Brush teeth',
    starts_at_local: '2026-12-01T08:00:00',
    time_zone: 'Europe/London',
    ...extra,
  });
}

function schedule(db: Db, owner: Row, sources: Row) {
  return insert(db, 'reminder_schedules', { owner_id: owner.id, ...sources });
}

function occurrence(db: Db, owner: Row, sched: Row, extra: Row = {}) {
  return insert(db, 'reminder_occurrences', {
    owner_id: owner.id,
    schedule_id: sched.id,
    schedule_version: 1,
    occurrence_key: '2026-12-01T08:00:00Z',
    trigger_at_utc: '2026-12-01T08:00:00Z',
    ...extra,
  });
}

function deviceToken(db: Db, owner: Row, extra: Row = {}) {
  return insert(db, 'device_tokens', {
    owner_id: owner.id,
    token: unique('push-token'),
    platform: 'ANDROID',
    last_seen_at: '2026-11-20T00:00:00Z',
    ...extra,
  });
}

describe('reminder_preferences', () => {
  it('uses the RM-01 defaults and allowed lead times', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const prefs = await insert(db, 'reminder_preferences', { owner_id: owner.id });
      expect(prefs).toMatchObject({
        push_enabled: false,
        appointment_lead_minutes: 1440,
        vaccine_lead_days: 7,
        date_only_delivery_time: '09:00:00',
      });
      const other = await createOwner(db);
      await expectViolation(
        db,
        () =>
          insert(db, 'reminder_preferences', { owner_id: other.id, appointment_lead_minutes: 30 }),
        { code: PgError.CHECK, constraint: 'reminder_preferences_appointment_lead_minutes_check' },
      );
      await expectViolation(
        db,
        () => insert(db, 'reminder_preferences', { owner_id: other.id, vaccine_lead_days: 3 }),
        { code: PgError.CHECK, constraint: 'reminder_preferences_vaccine_lead_days_check' },
      );
    }));
});

describe('device_tokens', () => {
  it('keeps one enabled row per token, so a new owner gets a fresh row', () =>
    inRolledBackTx(async (db) => {
      const a = await createOwner(db);
      const b = await createOwner(db);
      const tokenA = await deviceToken(db, a);
      await expectViolation(db, () => deviceToken(db, b, { token: tokenA.token }), {
        code: PgError.UNIQUE,
        constraint: 'device_tokens_one_enabled_token_key',
      });
      await db.query('UPDATE device_tokens SET enabled = false WHERE id = $1', [tokenA.id]);
      await deviceToken(db, b, { token: tokenA.token });
    }));
});

describe('custom_reminders', () => {
  it('requires a 1–150 character title and only Daily reminders can end', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      await expectViolation(db, () => customReminder(db, owner, pet, { title: '' }), {
        code: PgError.CHECK,
        constraint: 'custom_reminders_title_check',
      });
      await expectViolation(
        db,
        () => customReminder(db, owner, pet, { recurrence: 'NONE', ends_on: '2026-12-31' }),
        { code: PgError.CHECK, constraint: 'custom_reminders_ends_on_check' },
      );
      await customReminder(db, owner, pet, { recurrence: 'DAILY', ends_on: '2026-12-31' });
    }));
});

describe('reminder_schedules', () => {
  it('has exactly one source', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const custom = await customReminder(db, owner, pet);
      const visit = await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id);
      await expectViolation(db, () => schedule(db, owner, {}), {
        code: PgError.CHECK,
        constraint: 'reminder_schedules_one_source_check',
      });
      await expectViolation(
        db,
        () =>
          schedule(db, owner, {
            custom_reminder_id: custom.id,
            care_record_id: visit.id,
            care_record_kind: 'APPOINTMENT',
          }),
        { code: PgError.CHECK, constraint: 'reminder_schedules_one_source_check' },
      );
    }));

  it('never schedules alerts for general medical events', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const medical = await createCareRecord(db, 'MEDICAL', owner.id, pet.id);
      await expectViolation(
        db,
        () => schedule(db, owner, { care_record_id: medical.id, care_record_kind: 'MEDICAL' }),
        { code: PgError.CHECK, constraint: 'reminder_schedules_care_record_kind_check' },
      );
    }));

  it('cannot claim a different kind than the care record has', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await ownerWithPet(db);
      const vaccine = await createCareRecord(db, 'VACCINE', owner.id, pet.id);
      await expectViolation(
        db,
        () => schedule(db, owner, { care_record_id: vaccine.id, care_record_kind: 'APPOINTMENT' }),
        { code: PgError.FOREIGN_KEY },
      );
    }));

  it("cannot point at another owner's source", () =>
    inRolledBackTx(async (db) => {
      const { owner } = await ownerWithPet(db);
      const stranger = await ownerWithPet(db);
      const strangersVisit = await createCareRecord(
        db,
        'APPOINTMENT',
        stranger.owner.id,
        stranger.pet.id,
      );
      await expectViolation(
        db,
        () =>
          schedule(db, owner, {
            care_record_id: strangersVisit.id,
            care_record_kind: 'APPOINTMENT',
          }),
        { code: PgError.FOREIGN_KEY, constraint: /care_record_id/ },
      );
    }));

  it('keeps one schedule per source', () =>
    inRolledBackTx(async (db) => {
      const { owner } = await ownerWithPet(db);
      const item = await createInventoryItem(db, owner.id);
      const lowStock = await insert(db, 'inventory_alerts', {
        owner_id: owner.id,
        item_id: item.id,
        type: 'LOW_STOCK',
        episode_number: 1,
      });
      const sched = await schedule(db, owner, { inventory_alert_id: lowStock.id });
      expect(sched).toMatchObject({
        schedule_version: 1,
        enabled: true,
        suppressed_by_archive: false,
      });
      await expectViolation(db, () => schedule(db, owner, { inventory_alert_id: lowStock.id }), {
        code: PgError.UNIQUE,
        constraint: /inventory_alert_id/,
      });
    }));
});

describe('reminder_occurrences', () => {
  async function setup(db: Db) {
    const { owner, pet } = await ownerWithPet(db);
    const custom = await customReminder(db, owner, pet);
    const sched = await schedule(db, owner, { custom_reminder_id: custom.id });
    return { owner, pet, sched };
  }

  it('deduplicates by schedule, version and occurrence key', () =>
    inRolledBackTx(async (db) => {
      const { owner, sched } = await setup(db);
      const first = await occurrence(db, owner, sched);
      expect(first.state).toBe('PENDING');
      await expectViolation(db, () => occurrence(db, owner, sched), {
        code: PgError.UNIQUE,
        constraint: /occurrence_key/,
      });
      await occurrence(db, owner, sched, { schedule_version: 2 });
    }));

  it('allows one snooze follow-up per occurrence', () =>
    inRolledBackTx(async (db) => {
      const { owner, sched } = await setup(db);
      const original = await occurrence(db, owner, sched);
      const snooze = (key: string) =>
        occurrence(db, owner, sched, {
          occurrence_key: key,
          trigger_at_utc: '2026-12-01T08:15:00Z',
          snoozed_from_id: original.id,
        });
      await snooze('snooze-1');
      await expectViolation(db, () => snooze('snooze-2'), {
        code: PgError.UNIQUE,
        constraint: /snoozed_from_id/,
      });
    }));

  it("cannot target another owner's dose", () =>
    inRolledBackTx(async (db) => {
      const { owner, sched } = await setup(db);
      const stranger = await ownerWithPet(db);
      const rx = await createCareRecord(db, 'PRESCRIPTION', stranger.owner.id, stranger.pet.id);
      const dose = await insert(db, 'dose_occurrences', {
        owner_id: stranger.owner.id,
        prescription_id: rx.id,
        schedule_version: 1,
        scheduled_at_utc: '2026-12-01T08:00:00Z',
      });
      await expectViolation(
        db,
        () => occurrence(db, owner, sched, { dose_occurrence_id: dose.id }),
        { code: PgError.FOREIGN_KEY, constraint: /dose_occurrence_id/ },
      );
    }));
});

describe('push_deliveries', () => {
  async function setup(db: Db) {
    const { owner, pet } = await ownerWithPet(db);
    const custom = await customReminder(db, owner, pet);
    const sched = await schedule(db, owner, { custom_reminder_id: custom.id });
    const occ = await occurrence(db, owner, sched);
    return { owner, occ };
  }

  function delivery(db: Db, owner: Row, occ: Row, token: Row) {
    return insert(db, 'push_deliveries', {
      owner_id: owner.id,
      reminder_occurrence_id: occ.id,
      device_token_id: token.id,
    });
  }

  it('delivers once per occurrence and device', () =>
    inRolledBackTx(async (db) => {
      const { owner, occ } = await setup(db);
      const token = await deviceToken(db, owner);
      const first = await delivery(db, owner, occ, token);
      expect(first).toMatchObject({ state: 'PENDING', attempt_count: 0 });
      await expectViolation(db, () => delivery(db, owner, occ, token), {
        code: PgError.UNIQUE,
        constraint: /device_token_id/,
      });
    }));

  it('never sends through a token that belongs to another owner', () =>
    inRolledBackTx(async (db) => {
      const { owner, occ } = await setup(db);
      const stranger = await createOwner(db);
      const strangersToken = await deviceToken(db, stranger);
      await expectViolation(db, () => delivery(db, owner, occ, strangersToken), {
        code: PgError.FOREIGN_KEY,
        constraint: /device_token_id/,
      });
    }));

  it('stops after the first attempt plus three retries', () =>
    inRolledBackTx(async (db) => {
      const { owner, occ } = await setup(db);
      const token = await deviceToken(db, owner);
      const d = await delivery(db, owner, occ, token);
      await expectViolation(
        db,
        () => db.query('UPDATE push_deliveries SET attempt_count = 5 WHERE id = $1', [d.id]),
        { code: PgError.CHECK, constraint: 'push_deliveries_attempt_count_check' },
      );
    }));
});
