/**
 * FN-01 — owner identity and access boundaries, with sign-in postponed.
 * Design: docs/superpowers/specs/2026-11-23-fn-01-dev-owner-identity-design.md
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OwnerIdentityService } from '../src/auth/owner-identity.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createApp } from './support/create-app.js';

const SIGN_IN_REQUIRED = {
  statusCode: 401,
  code: 'UNAUTHORIZED',
  message: 'Sign-in required',
  details: null,
};

// Owner names unique to this run, so parallel runs never share owners; deleted in afterAll.
const run = randomUUID().slice(0, 8);
const ownerName = (label: string) => `e2e-${run}-${label}`;

describe('Owner identity (e2e)', () => {
  describe('with AUTH_MODE=dev', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
      app = await createApp('dev');
      prisma = app.get(PrismaService);
    });

    afterAll(async () => {
      await prisma.owner.deleteMany({ where: { authSubject: { startsWith: `dev:e2e-${run}-` } } });
      await app.close();
    });

    const me = (owner?: string) => {
      const req = request(app.getHttpServer()).get('/v1/me');
      return owner === undefined ? req : req.set('X-Dev-Owner', owner);
    };

    it('rejects a request without the header', async () => {
      const res = await me().expect(401);
      expect(res.body).toEqual(SIGN_IN_REQUIRED);
    });

    it('rejects a malformed header with the same response', async () => {
      const res = await me('not a valid name').expect(401);
      expect(res.body).toEqual(SIGN_IN_REQUIRED);
    });

    it('keeps the health endpoints public', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/health/ready').expect(200);
    });

    it('creates the owner on first use and returns only their profile fields', async () => {
      const name = ownerName('first');
      const res = await me(name).expect(200);
      expect(res.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        displayName: `Dev owner ${name}`,
        phone: null,
        timeZone: 'UTC',
        version: 1,
        profileSetupRequired: true,
        weightUnit: 'KG',
      });
      const stored = await prisma.owner.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored.authSubject).toBe(`dev:${name}`);
    });

    it('returns the same owner for the same header', async () => {
      const name = ownerName('same');
      const first = await me(name).expect(200);
      const second = await me(name).expect(200);
      expect(second.body.id).toBe(first.body.id);
    });

    it('gives each header its own owner and shows each only their own profile', async () => {
      const a = await me(ownerName('a')).expect(200);
      const b = await me(ownerName('b')).expect(200);
      expect(a.body.id).not.toBe(b.body.id);
      expect(a.body.displayName).toBe(`Dev owner ${ownerName('a')}`);
      expect(b.body.displayName).toBe(`Dev owner ${ownerName('b')}`);
    });

    it('creates exactly one owner when first requests arrive together', async () => {
      const name = ownerName('race');
      const responses = await Promise.all(Array.from({ length: 20 }, () => me(name)));
      const ids = new Set(responses.map((r) => (r.body as { id: string }).id));
      expect(responses.map((r) => r.status)).toEqual(Array.from({ length: 20 }, () => 200));
      expect(ids.size).toBe(1);
      expect(await prisma.owner.count({ where: { authSubject: `dev:${name}` } })).toBe(1);
    });

    it('resolves simultaneous first lookups of one subject to a single owner', async () => {
      const identity = app.get(OwnerIdentityService);
      const subject = `dev:${ownerName('burst')}`;
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => identity.resolveDevOwner(subject)),
      );
      expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
      const ids = new Set(results.map((r) => (r.status === 'fulfilled' ? r.value.id : null)));
      expect(ids.size).toBe(1);
    });

    it('rejects an owner whose account is no longer active', async () => {
      const name = ownerName('closing');
      const created = await me(name).expect(200);
      await prisma.owner.update({
        where: { id: created.body.id as string },
        data: { accountStatus: 'DELETION_REQUESTED' },
      });
      const res = await me(name).expect(401);
      expect(res.body).toEqual(SIGN_IN_REQUIRED);
    });
  });

  describe('with AUTH_MODE=none (the default)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp('none');
    });

    afterAll(async () => {
      await app.close();
    });

    it('rejects protected routes even when the header is sent', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/me')
        .set('X-Dev-Owner', ownerName('ignored'))
        .expect(401);
      expect(res.body).toEqual(SIGN_IN_REQUIRED);
    });

    it('still serves the health endpoints', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });
  });
});
