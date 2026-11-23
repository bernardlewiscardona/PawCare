/**
 * PF-01 — owner profile API.
 * Design: docs/superpowers/specs/2026-11-23-pf-01-owner-profile-api-design.md
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createApp } from './support/create-app.js';

// Owner names unique to this run; their rows are deleted in afterAll.
const run = randomUUID().slice(0, 8);
const ownerName = (label: string) => `e2e-${run}-${label}`;

const SETUP_FIELD_MESSAGE = 'Required to finish setting up your profile.';

describe('Owner profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp('dev');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const owners = await prisma.owner.findMany({
      where: { authSubject: { startsWith: `dev:e2e-${run}-` } },
      select: { id: true },
    });
    const ids = owners.map((o) => o.id);
    await prisma.auditEvent.deleteMany({ where: { actorOwnerId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.owner.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  const get = (owner: string) =>
    request(app.getHttpServer()).get('/v1/me').set('X-Dev-Owner', owner);
  const patch = (owner: string, body: object) =>
    request(app.getHttpServer()).patch('/v1/me').set('X-Dev-Owner', owner).send(body);

  /** Creates the owner and completes setup; the profile is then at version 2. */
  async function setUp(label: string) {
    const owner = ownerName(label);
    const res = await patch(owner, { version: 1, displayName: 'Bea', timeZone: 'Asia/Manila' });
    expect(res.status).toBe(200);
    return { owner, id: res.body.id as string };
  }

  const eventCounts = async (ownerId: string) => ({
    audit: await prisma.auditEvent.count({ where: { objectId: ownerId } }),
    outbox: await prisma.outboxEvent.count({ where: { ownerId } }),
  });

  it('reports that a new owner still has to set up their profile', async () => {
    const res = await get(ownerName('new')).expect(200);
    expect(res.body.profileSetupRequired).toBe(true);
  });

  it('completes setup on the first save of name and time zone', async () => {
    const owner = ownerName('first');
    const res = await patch(owner, {
      version: 1,
      displayName: ' Bea Santos ',
      timeZone: 'Asia/Manila',
    }).expect(200);
    const expected = {
      id: expect.any(String),
      displayName: 'Bea Santos',
      phone: null,
      timeZone: 'Asia/Manila',
      version: 2,
      profileSetupRequired: false,
      weightUnit: 'KG',
    };
    expect(res.body).toEqual(expected);
    expect((await get(owner).expect(200)).body).toEqual(expected);
  });

  it('requires both name and time zone on the first save, and saves nothing otherwise', async () => {
    const owner = ownerName('partial');
    const res = await patch(owner, { version: 1, displayName: 'Bea' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.fields).toEqual({ timeZone: [SETUP_FIELD_MESSAGE] });
    const after = (await get(owner).expect(200)).body;
    expect(after).toMatchObject({ version: 1, profileSetupRequired: true });
  });

  it('changes a single field after setup and stores phones in international format', async () => {
    const { owner } = await setUp('phone');
    const added = await patch(owner, { version: 2, phone: '+63 917 123 4567' }).expect(200);
    expect(added.body).toMatchObject({ phone: '+639171234567', version: 3 });
    const removed = await patch(owner, { version: 3, phone: null }).expect(200);
    expect(removed.body).toMatchObject({ phone: null, version: 4 });
  });

  it('saves the weight display unit as a single-field change', async () => {
    const { owner, id } = await setUp('unit');
    const res = await patch(owner, { version: 2, weightUnit: 'LB' }).expect(200);
    expect(res.body).toMatchObject({ weightUnit: 'LB', version: 3 });
    const latest = await prisma.outboxEvent.findFirst({
      where: { ownerId: id },
      orderBy: { createdAt: 'desc' },
    });
    expect(latest?.payload).toMatchObject({ changedFields: ['weightUnit'] });
  });

  it('rejects an unknown weight unit', async () => {
    const { owner } = await setUp('bad-unit');
    const res = await patch(owner, { version: 2, weightUnit: 'STONE' }).expect(400);
    expect(res.body.details.fields).toEqual({
      weightUnit: ['weightUnit must be one of the following values: KG, LB'],
    });
  });

  it('reports every invalid field at once', async () => {
    const res = await patch(ownerName('invalid'), {
      version: 1,
      displayName: '   ',
      timeZone: 'Mars/Base',
      phone: '0917',
    }).expect(400);
    expect(res.body.details.fields).toEqual({
      displayName: ['Enter a name of 1–100 characters.'],
      timeZone: ['Choose a valid time zone.'],
      phone: ['Enter the number with its country code, like +63 917 123 4567.'],
    });
  });

  it('rejects a version sent as a string', async () => {
    const res = await patch(ownerName('string-version'), {
      version: '1',
      displayName: 'Bea',
      timeZone: 'UTC',
    }).expect(400);
    expect(Object.keys(res.body.details.fields)).toEqual(['version']);
  });

  it('rejects null for the name and time zone instead of failing', async () => {
    const res = await patch(ownerName('nulls'), {
      version: 1,
      displayName: null,
      timeZone: null,
    }).expect(400);
    expect(Object.keys(res.body.details.fields).sort()).toEqual(['displayName', 'timeZone']);
  });

  it('rejects a version beyond the stored integer range', async () => {
    const res = await patch(ownerName('huge-version'), {
      version: 3000000000,
      displayName: 'Bea',
      timeZone: 'UTC',
    }).expect(400);
    expect(Object.keys(res.body.details.fields)).toEqual(['version']);
  });

  it('rejects fields that are not part of the profile', async () => {
    const res = await patch(ownerName('extra'), {
      version: 1,
      displayName: 'Bea',
      timeZone: 'UTC',
      authSubject: 'dev:someone-else',
    }).expect(400);
    expect(Object.keys(res.body.details.fields)).toEqual(['authSubject']);
  });

  it('requires an owner identity', async () => {
    const res = await request(app.getHttpServer()).patch('/v1/me').send({ version: 1 }).expect(401);
    expect(res.body.message).toBe('Sign-in required');
  });

  it('refuses a stale version and returns the current profile', async () => {
    const { owner } = await setUp('stale');
    const res = await patch(owner, { version: 1, displayName: 'Old tab' }).expect(409);
    expect(res.body.code).toBe('CONFLICT');
    expect(res.body.details.current).toMatchObject({ displayName: 'Bea', version: 2 });
    expect((await get(owner).expect(200)).body.displayName).toBe('Bea');
  });

  it('lets only one of two simultaneous edits of the same version win', async () => {
    const { owner } = await setUp('concurrent');
    const results = await Promise.all([
      patch(owner, { version: 2, displayName: 'Phone A' }),
      patch(owner, { version: 2, displayName: 'Phone B' }),
    ]);
    expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([200, 409]);
  });

  it('treats a save with nothing to change as a no-op', async () => {
    const { owner, id } = await setUp('noop');
    const before = await eventCounts(id);
    const res = await patch(owner, { version: 2 }).expect(200);
    expect(res.body.version).toBe(2);
    expect(await eventCounts(id)).toEqual(before);
  });

  it('records one audit and one outbox event with field names only', async () => {
    const owner = ownerName('events');
    const res = await patch(owner, {
      version: 1,
      displayName: 'Bea Santos',
      timeZone: 'Asia/Manila',
    }).expect(200);
    const id = res.body.id as string;
    const audit = await prisma.auditEvent.findMany({ where: { objectId: id } });
    const outbox = await prisma.outboxEvent.findMany({ where: { ownerId: id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorOwnerId: id,
      action: 'owner.profile_updated',
      objectType: 'owner',
      changeMetadata: { fields: ['displayName', 'timeZone'] },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      eventType: 'owner.profile_updated',
      aggregateType: 'owner',
      aggregateId: id,
      aggregateVersion: 2,
      payload: {
        changedFields: ['displayName', 'timeZone'],
        timeZoneChanged: true,
        setupCompleted: true,
      },
    });
    const stored = JSON.stringify([audit, outbox]);
    expect(stored).not.toContain('Bea Santos');
    expect(stored).not.toContain('Asia/Manila');
  });

  it('records no events when a save fails', async () => {
    const { owner, id } = await setUp('failed');
    const before = await eventCounts(id);
    await patch(owner, { version: 2, timeZone: 'Mars/Base' }).expect(400);
    await patch(owner, { version: 1, displayName: 'Stale' }).expect(409);
    expect(await eventCounts(id)).toEqual(before);
  });

  it("never changes another owner's profile", async () => {
    const a = await setUp('owner-a');
    const b = await setUp('owner-b');
    await patch(b.owner, { version: 2, displayName: 'Owner B renamed' }).expect(200);
    expect((await get(a.owner).expect(200)).body).toMatchObject({
      id: a.id,
      displayName: 'Bea',
      version: 2,
    });
  });
});
