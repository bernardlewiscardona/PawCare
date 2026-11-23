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

  /** An owner who has finished profile setup (PF-01), so they can add pets. */
  const readyOwner = async (label: string, timeZone = 'UTC') => {
    const name = ownerName(label);
    await prisma.owner.create({
      data: {
        authSubject: `dev:${name}`,
        displayName: `Owner ${label}`,
        timeZone,
        profileCompletedAt: new Date(),
      },
    });
    return name;
  };
  const create = (owner: string, body: object, key: string | null = randomUUID()) => {
    const req = request(app.getHttpServer()).post('/v1/pets').set('X-Dev-Owner', owner);
    return (key === null ? req : req.set('Idempotency-Key', key)).send(body);
  };
  const petCount = async (owner: string) =>
    prisma.pet.count({ where: { owner: { authSubject: `dev:${owner}` } } });
  const fieldsOf = (res: { body: { details: { fields: Record<string, string[]> } } }) =>
    res.body.details.fields;

  describe('POST /v1/pets', () => {
    it('creates a pet from just a name and species', async () => {
      const res = await create(await readyOwner('minimal'), {
        name: 'Mochi',
        species: 'CAT',
      }).expect(201);
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
      const owner = await readyOwner('full');
      const before = localDate('UTC');
      const res = await create(owner, {
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
        microchip: '985112345678901',
      });
      // Either side of midnight UTC, if the request straddled it.
      expect([before, localDate('UTC')]).toContain(res.body.weightMeasuredOn);
    });

    it('keeps the measurement date the owner entered', async () => {
      const res = await create(await readyOwner('measured'), {
        name: 'Mochi',
        species: 'CAT',
        weight: { value: 4.2, unit: 'KG' },
        weightMeasuredOn: '2026-01-15',
      }).expect(201);
      expect(res.body).toMatchObject({ currentWeightKg: 4.2, weightMeasuredOn: '2026-01-15' });
    });

    it('stores a very small animal to the gram', async () => {
      const owner = await readyOwner('tiny');
      const res = await create(owner, {
        name: 'Pip',
        species: 'BIRD',
        weight: { value: 0.015, unit: 'KG' },
      }).expect(201);
      expect(res.body.currentWeightKg).toBe(0.015);
      const read = await request(app.getHttpServer())
        .get(`/v1/pets/${res.body.id}`)
        .set('X-Dev-Owner', owner)
        .expect(200);
      expect(read.body.currentWeightKg).toBe(0.015);
    });

    it("judges dates against today in the owner's time zone", async () => {
      const owner = await readyOwner('manila', 'Asia/Manila');
      // 23:30 UTC is already the next day in Manila (UTC+8).
      const now = new Date();
      const at = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 30),
      );
      const manilaToday = localDate('Asia/Manila', at);
      expect(manilaToday).not.toBe(localDate('UTC', at));
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(at);
      try {
        const res = await create(owner, {
          name: 'Mochi',
          species: 'CAT',
          birthDate: manilaToday,
          weight: { value: 4, unit: 'KG' },
        }).expect(201);
        expect(res.body).toMatchObject({ birthDate: manilaToday, weightMeasuredOn: manilaToday });
      } finally {
        vi.useRealTimers();
      }
    });

    it('requires a description only for species Other', async () => {
      const owner = await readyOwner('other');
      const missing = await create(owner, { name: 'Shelly', species: 'OTHER' }).expect(400);
      expect(Object.keys(fieldsOf(missing))).toEqual(['speciesOther']);
      const extra = await create(owner, {
        name: 'Rex',
        species: 'DOG',
        speciesOther: 'Wolf',
      }).expect(400);
      expect(fieldsOf(extra)).toEqual({
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
      const owner = await readyOwner('invalid');
      const res = await create(owner, {
        name: 'Mochi',
        species: 'CAT',
        birthDate: '2999-01-01',
        birthDateEstimated: true,
        weight: { value: 0, unit: 'KG' },
        microchip: '985-112',
      }).expect(400);
      expect(fieldsOf(res)).toEqual({
        birthDate: ["The birth date can't be in the future."],
        weight: ['Enter a weight above 0 and up to 1,000 kg.'],
        microchip: ['Enter 1–50 letters or digits.'],
      });
      const noDate = await create(owner, {
        name: 'Mochi',
        species: 'CAT',
        birthDateEstimated: true,
      }).expect(400);
      expect(fieldsOf(noDate)).toEqual({
        birthDateEstimated: ['Add a birth date to mark it as estimated.'],
      });
      expect(await petCount(owner)).toBe(0);
    });

    it('rejects a missing or invalid name and species', async () => {
      const owner = await readyOwner('required');
      const missing = await create(owner, {}).expect(400);
      expect(Object.keys(fieldsOf(missing)).sort()).toEqual(['name', 'species']);
      const badSpecies = await create(owner, { name: 'Mochi', species: 'FISH' }).expect(400);
      expect(Object.keys(fieldsOf(badSpecies))).toEqual(['species']);
      const longName = await create(owner, { name: 'x'.repeat(101), species: 'CAT' }).expect(400);
      expect(fieldsOf(longName)).toEqual({ name: ['Enter a name of 1–100 characters.'] });
      const blankName = await create(owner, { name: '   ', species: 'CAT' }).expect(400);
      expect(fieldsOf(blankName)).toEqual({ name: ['Enter a name of 1–100 characters.'] });
    });

    it('checks the measurement date', async () => {
      const owner = await readyOwner('measured-bad');
      const future = await create(owner, {
        name: 'Mochi',
        species: 'CAT',
        weight: { value: 4, unit: 'KG' },
        weightMeasuredOn: '2999-01-01',
      }).expect(400);
      expect(fieldsOf(future)).toEqual({
        weightMeasuredOn: ["The measurement date can't be in the future."],
      });
      const noWeight = await create(owner, {
        name: 'Mochi',
        species: 'CAT',
        weightMeasuredOn: '2026-01-15',
      }).expect(400);
      expect(fieldsOf(noWeight)).toEqual({
        weightMeasuredOn: ['Add a weight for this measurement date.'],
      });
    });

    it('reports every weight error under the weight field, in the unit entered', async () => {
      const owner = await readyOwner('weight-errors');
      const pounds = await create(owner, {
        name: 'Kape',
        species: 'DOG',
        weight: { value: 2205, unit: 'LB' },
      }).expect(400);
      expect(fieldsOf(pounds)).toEqual({
        weight: ['Enter a weight above 0 and up to 2,204.62 lb.'],
      });
      const malformed = await create(owner, {
        name: 'Kape',
        species: 'DOG',
        weight: { value: 'heavy', unit: 'STONE' },
      }).expect(400);
      expect(Object.keys(fieldsOf(malformed))).toEqual(['weight']);
      expect(fieldsOf(malformed).weight.length).toBeGreaterThanOrEqual(2);
    });

    it('requires the Idempotency-Key header', async () => {
      const res = await create(
        await readyOwner('no-key'),
        { name: 'Mochi', species: 'CAT' },
        null,
      ).expect(400);
      expect(fieldsOf(res)).toEqual({
        'Idempotency-Key': ['Send an Idempotency-Key header of 1–100 visible characters.'],
      });
    });

    it('reports a missing key together with body errors', async () => {
      const owner = await readyOwner('no-key-bad-body');
      const typed = await create(owner, { name: 'Mochi' }, null).expect(400);
      expect(Object.keys(fieldsOf(typed)).sort()).toEqual(['Idempotency-Key', 'species']);
      const rules = await create(
        owner,
        { name: 'Mochi', species: 'CAT', birthDate: '2999-01-01' },
        null,
      ).expect(400);
      expect(Object.keys(fieldsOf(rules)).sort()).toEqual(['Idempotency-Key', 'birthDate']);
    });

    it.each([['x'.repeat(101)], ['two words'], ['clé']])('rejects the key %j', async (key) => {
      const owner = await readyOwner(`bad-key-${randomUUID().slice(0, 6)}`);
      const res = await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(400);
      expect(Object.keys(fieldsOf(res))).toEqual(['Idempotency-Key']);
      expect(await petCount(owner)).toBe(0);
    });

    it('requires an owner identity', async () => {
      await request(app.getHttpServer())
        .post('/v1/pets')
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'Mochi', species: 'CAT' })
        .expect(401);
    });

    it('asks the owner to finish profile setup first', async () => {
      const owner = ownerName('no-setup');
      const key = randomUUID();
      const res = await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'PROFILE_SETUP_REQUIRED',
        message: 'Finish setting up your profile before adding a pet.',
        details: null,
      });
      expect(await petCount(owner)).toBe(0);

      // After setup, the same request (same key) goes through.
      await prisma.owner.update({
        where: { authSubject: `dev:${owner}` },
        data: { timeZone: 'Asia/Manila', profileCompletedAt: new Date() },
      });
      await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(201);
      expect(await petCount(owner)).toBe(1);
    });

    it('creates one pet when the same request is retried', async () => {
      const owner = await readyOwner('retry');
      const key = randomUUID();
      const first = await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(201);
      const again = await create(owner, { species: 'CAT', name: '  Mochi ' }, key).expect(201);
      expect(again.body.id).toBe(first.body.id);
      expect(await petCount(owner)).toBe(1);
    });

    it("keeps one owner's keys apart from another's", async () => {
      const a = await readyOwner('key-a');
      const b = await readyOwner('key-b');
      const key = randomUUID();
      const petOfA = await create(a, { name: 'Mochi', species: 'CAT' }, key).expect(201);
      const petOfB = await create(b, { name: 'Kape', species: 'DOG' }, key).expect(201);
      expect(petOfB.body.id).not.toBe(petOfA.body.id);
      expect(petOfB.body.name).toBe('Kape');
    });

    it('refuses a key reused for a different pet', async () => {
      const owner = await readyOwner('reuse');
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
      const owner = await readyOwner('burst');
      const key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => create(owner, { name: 'Mochi', species: 'CAT' }, key)),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(new Set(results.map((r) => (r.body as { id: string }).id)).size).toBe(1);
      expect(await petCount(owner)).toBe(1);
    });

    it('accepts an expired key again as a new request', async () => {
      const owner = await readyOwner('expired');
      const key = randomUUID();
      const first = await create(owner, { name: 'Mochi', species: 'CAT' }, key).expect(201);
      await prisma.idempotencyRequest.updateMany({
        where: { requestKey: key },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const second = await create(owner, { name: 'Kape', species: 'DOG' }, key).expect(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it('allows two pets with the same name or microchip', async () => {
      const owner = await readyOwner('twins');
      const twin = { name: 'Mochi', species: 'CAT', microchip: '985112345678901' };
      await create(owner, twin).expect(201);
      await create(owner, twin).expect(201);
      expect(await petCount(owner)).toBe(2);
    });

    it('records one audit and one outbox event without pet details', async () => {
      const res = await create(await readyOwner('events'), {
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
  const list = (owner: string, query = '') =>
    request(app.getHttpServer()).get(`/v1/pets${query}`).set('X-Dev-Owner', owner);
  const read = (owner: string, id: string) =>
    request(app.getHttpServer()).get(`/v1/pets/${id}`).set('X-Dev-Owner', owner);

  describe('GET /v1/pets', () => {
    it('pages through pets in the order they were added', async () => {
      const owner = await readyOwner('pages');
      const ids: string[] = [];
      for (let i = 0; i < 25; i++) {
        const res = await create(owner, { name: `Pet ${i}`, species: 'CAT' }).expect(201);
        ids.push(res.body.id as string);
      }
      const first = await list(owner).expect(200);
      expect(first.body.data).toHaveLength(20);
      expect(first.body.nextCursor).toBe(ids[19]);
      const second = await list(owner, `?cursor=${first.body.nextCursor}`).expect(200);
      expect(second.body.data).toHaveLength(5);
      expect(second.body.nextCursor).toBeNull();
      const all = [...first.body.data, ...second.body.data].map((p: { id: string }) => p.id);
      expect(all).toEqual(ids);
      expect((await list(owner, '?limit=5').expect(200)).body.data).toHaveLength(5);
    });

    it.each([['?limit=0'], ['?limit=101'], ['?limit=abc']])('rejects %s', async (query) => {
      const res = await list(ownerName('bad-limit'), query).expect(400);
      expect(Object.keys(fieldsOf(res))).toEqual(['limit']);
    });

    it('rejects a cursor that is not a pet ID', async () => {
      const res = await list(ownerName('bad-cursor'), '?cursor=nope').expect(400);
      expect(Object.keys(fieldsOf(res))).toEqual(['cursor']);
    });

    it('leaves archived pets out of the list but keeps them readable', async () => {
      const owner = await readyOwner('archived');
      const kept = await create(owner, { name: 'Mochi', species: 'CAT' }).expect(201);
      const gone = await create(owner, { name: 'Bantay', species: 'DOG' }).expect(201);
      await prisma.pet.update({ where: { id: gone.body.id }, data: { archivedAt: new Date() } });
      const res = await list(owner).expect(200);
      expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([kept.body.id]);
      expect((await read(owner, gone.body.id).expect(200)).body.name).toBe('Bantay');
    });
  });

  describe('GET /v1/pets/:id', () => {
    it('returns the pet as it was created', async () => {
      const owner = await readyOwner('read');
      const created = await create(owner, { name: 'Mochi', species: 'CAT' }).expect(201);
      expect((await read(owner, created.body.id).expect(200)).body).toEqual(created.body);
    });

    it("answers another owner's pet exactly like a pet that doesn't exist", async () => {
      const a = await readyOwner('iso-a');
      const b = ownerName('iso-b');
      const petOfA = await create(a, { name: 'Mochi', species: 'CAT' }).expect(201);
      const notFound = { statusCode: 404, code: 'NOT_FOUND', message: 'Not found', details: null };
      const stolen = await read(b, petOfA.body.id).expect(404);
      const missing = await read(b, randomUUID()).expect(404);
      const malformed = await read(b, 'not-a-uuid').expect(404);
      expect(stolen.body).toEqual(notFound);
      expect(missing.body).toEqual(notFound);
      expect(malformed.body).toEqual(notFound);
      const listOfB = await list(b).expect(200);
      expect(listOfB.body.data.map((p: { id: string }) => p.id)).not.toContain(petOfA.body.id);
    });
  });
});
