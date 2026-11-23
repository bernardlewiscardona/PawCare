/**
 * ERD section 5 — idempotency, audit, outbox and deletion jobs (FN-01, FN-02, shared requirements).
 */
import { randomUUID } from 'node:crypto';
import {
  PgError,
  closePool,
  createOwner,
  expectViolation,
  inRolledBackTx,
  insert,
  type Db,
  type Row,
} from './db/db-test-helpers.js';

afterAll(async () => {
  await closePool();
});

function auditEvent(db: Db, owner: Row) {
  return insert(db, 'audit_events', {
    actor_owner_id: owner.id,
    action: 'pet.archived',
    object_type: 'pet',
    object_id: randomUUID(),
  });
}

describe('idempotency_requests', () => {
  it('accepts a request key once per owner and operation', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const other = await createOwner(db);
      const request = (ownerId: unknown, operation: string) =>
        insert(db, 'idempotency_requests', {
          owner_id: ownerId,
          request_key: 'client-key-1',
          operation,
          payload_hash: 'a'.repeat(64),
          expires_at: '2026-11-24T00:00:00Z',
        });
      const first = await request(owner.id, 'pet.create');
      expect(first.state).toBe('IN_PROGRESS');
      await request(owner.id, 'appointment.create');
      await request(other.id, 'pet.create');
      await expectViolation(db, () => request(owner.id, 'pet.create'), {
        code: PgError.UNIQUE,
        constraint: /request_key/,
      });
    }));
});

describe('audit_events', () => {
  it('cannot be edited after it is written', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const event = await auditEvent(db, owner);
      await expectViolation(
        db,
        () => db.query("UPDATE audit_events SET action = 'edited' WHERE id = $1", [event.id]),
        { code: PgError.RAISED, message: /audit events are immutable/i },
      );
    }));

  it('keeps the event but drops the actor when the account is erased', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const event = await auditEvent(db, owner);
      await db.query('DELETE FROM owners WHERE id = $1', [owner.id]);
      const { rows } = await db.query<Row>(
        'SELECT actor_owner_id FROM audit_events WHERE id = $1',
        [event.id],
      );
      expect(rows).toEqual([{ actor_owner_id: null }]);
    }));
});

describe('outbox_events', () => {
  it('queues events as PENDING with no attempts', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const event = await insert(db, 'outbox_events', {
        owner_id: owner.id,
        event_type: 'appointment.canceled',
        aggregate_type: 'appointment',
        aggregate_id: randomUUID(),
        aggregate_version: 2,
      });
      expect(event).toMatchObject({ state: 'PENDING', attempt_count: 0, payload: {} });
    }));
});

describe('deletion_jobs', () => {
  it('keeps one unfinished deletion job per owner', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const job = await insert(db, 'deletion_jobs', { owner_id: owner.id });
      expect(job).toMatchObject({ state: 'REQUESTED', completed_steps: [], attempt_count: 0 });
      await expectViolation(db, () => insert(db, 'deletion_jobs', { owner_id: owner.id }), {
        code: PgError.UNIQUE,
        constraint: 'deletion_jobs_one_open_per_owner_key',
      });
    }));
});
