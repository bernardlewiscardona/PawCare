/**
 * PF-02 — register a pet. Also the first cross-owner (FN-01) checks on a resource ID.
 * Design: docs/superpowers/specs/2026-11-23-pf-02-register-pet-api-design.md
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { localDate } from '../src/common/time/local-date.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createApp } from './support/create-app.js';

// Owner names unique to this run; their rows are deleted in afterAll.
const run = randomUUID().slice(0, 8);
const ownerName = (label: string) => `e2e-${run}-${label}`;

describe('Pets (e2e)', () => {
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
    const ownerId = { in: owners.map((o) => o.id) };
    await prisma.auditEvent.deleteMany({ where: { actorOwnerId: ownerId } });
    await prisma.outboxEvent.deleteMany({ where: { ownerId } });
    await prisma.idempotencyRequest.deleteMany({ where: { ownerId } });
    await prisma.pet.deleteMany({ where: { ownerId } });
    await prisma.owner.deleteMany({ where: { id: ownerId } });
    await app.close();
  });

  const create = (owner: string, body: object, key: string | null = randomUUID()) => {
    const req = request(app.getHttpServer()).post('/v1/pets').set('X-Dev-Owner', owner);
    return (key === null ? req : req.set('Idempotency-Key', key)).send(body);
  };
  const petCount = async (owner: string) =>
    prisma.pet.count({ where: { owner: { authSubject: `dev:${owner}` } } });

  describe('POST /v1/pets', () => {
    it('creates a pet from just a name and species', async () => {
      const res = await create(ownerName('minimal'), { name: 'Mochi', species: 'CAT' }).expect(201);
      expect(res.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: 'Mochi',
        species: 'CAT',
        speciesOther: null,
        breed: null,
        sex: 'UNKNOWN',
        birthDate: null,
        birthDateEstimated: false,
        currentWeightKg: null,
        weightMeasuredOn: null,
        microchip: null,
        version: 1,
        createdAt: expect.any(String),
      });
    });

    it('stores a weight given in pounds as kilograms, measured today by default', async () => {
      const res = await create(ownerName('full'), {
        name: ' Kape ',
        species: 'DOG',
        breed: ' Aspin ',
        sex: 'MALE',
        birthDate: '2021-03-14',
        birthDateEstimated: true,
        weight: { value: 22, unit: 'LB' },
        microchip: ' 985112345678901 ',
      }).expect(201);
      expect(res.body).toMatchObject({
        name: 'Kape',
        breed: 'Aspin',
        sex: 'MALE',
        birthDate: '2021-03-14',
        birthDateEstimated: true,
        currentWeightKg: 9.979,
        weightMeasuredOn: localDate('UTC'),
        microchip: '985112345678901',
      });
    });

    it('requires a description only for species Other', async () => {
      const owner = ownerName('other');
      const missing = await create(owner, { name: 'Shelly', species: 'OTHER' }).expect(400);
      expect(Object.keys(missing.body.details.fields)).toEqual(['speciesOther']);
      const extra = await create(owner, {
        name: 'Rex',
        species: 'DOG',
        speciesOther: 'Wolf',
      }).expect(400);
      expect(extra.body.details.fields).toEqual({
        speciesOther: ['Only add a description when the species is Other.'],
      });
      const ok = await create(owner, {
        name: 'Shelly',
        species: 'OTHER',
        speciesOther: 'Tortoise',
      }).expect(201);
      expect(ok.body.speciesOther).toBe('Tortoise');
    });

    it('rejects each invalid field in one response', async () => {
      const res = await create(ownerName('invalid'), {
        name: 'Mochi',
        species: 'CAT',
        birthDate: '2999-01-01',
        birthDateEstimated: true,
        weight: { value: 0, unit: 'KG' },
      }).expect(400);
      expect(res.body.details.fields).toEqual({
        birthDate: ["The birth date can't be in the future."],
        weight: ['Enter a weight above 0 and up to 1,000 kg.'],
      });
      const noDate = await create(ownerName('invalid'), {
        name: 'Mochi',
        species: 'CAT',
        birthDateEstimated: true,
      }).expect(400);
      expect(noDate.body.details.fields).toEqual({
        birthDateEstimated: ['Add a birth date to mark it as estimated.'],
      });
    });

    it('requires the Idempotency-Key header', async () => {
      const res = await create(ownerName('no-key'), { name: 'Mochi', species: 'CAT' }, null).expect(
        400,
      );
      expect(res.body.details.fields).toEqual({
        'Idempotency-Key': ['Send an Idempotency-Key header of 1–100 visible characters.'],
      });
    });

    it('requires an owner identity', async () => {
      await request(app.getHttpServer())
        .post('/v1/pets')
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'Mochi', species: 'CAT' })
        .expect(401);
    });

    it('creates one pet when the same request is retried', async () => {
      const owner = ownerName('retry');
      const key = randomUUID();
      const first = await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(201);
      const again = await create(owner, { species: 'CAT', name: '  Mochi ' }, key).expect(201);
      expect(again.body.id).toBe(first.body.id);
      expect(await petCount(owner)).toBe(1);
    });

    it('refuses a key reused for a different pet', async () => {
      const owner = ownerName('reuse');
      const key = randomUUID();
      await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(201);
      const res = await create(owner, { name: 'Kape', species: 'DOG' }, key).expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This request key was already used for a different request.',
        details: null,
      });
    });

    it('creates one pet when retries arrive at the same time', async () => {
      const owner = ownerName('burst');
      const key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => create(owner, { name: 'Mochi', species: 'CAT' }, key)),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(new Set(results.map((r) => (r.body as { id: string }).id)).size).toBe(1);
      expect(await petCount(owner)).toBe(1);
    });

    it('accepts an expired key again as a new request', async () => {
      const owner = ownerName('expired');
      const key = randomUUID();
      const first = await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(201);
      await prisma.idempotencyRequest.updateMany({
        where: { requestKey: key },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const second = await create(owner, { name: 'Kape', species: 'DOG' }, key).expect(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it('allows two pets with the same name', async () => {
      const owner = ownerName('twins');
      await create(owner, { name: 'Mochi', species: 'CAT' }).expect(201);
      await create(owner, { name: 'Mochi', species: 'CAT' }).expect(201);
      expect(await petCount(owner)).toBe(2);
    });

    it('records one audit and one outbox event without pet details', async () => {
      const res = await create(ownerName('events'), {
        name: 'Biscuit',
        species: 'DOG',
        microchip: '985112345678901',
      }).expect(201);
      const id = res.body.id as string;
      const audit = await prisma.auditEvent.findMany({ where: { objectId: id } });
      const outbox = await prisma.outboxEvent.findMany({ where: { aggregateId: id } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ action: 'pet.created', objectType: 'pet' });
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({
        eventType: 'pet.created',
        aggregateType: 'pet',
        aggregateVersion: 1,
        payload: { petId: id },
      });
      const stored = JSON.stringify([audit, outbox]);
      expect(stored).not.toContain('Biscuit');
      expect(stored).not.toContain('985112345678901');
    });
  });
});
