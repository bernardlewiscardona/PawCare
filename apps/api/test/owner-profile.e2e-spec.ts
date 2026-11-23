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

describe('Owner profile (e2e)', () => {
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

  const get = (owner: string) =>
    request(app.getHttpServer()).get('/v1/me').set('X-Dev-Owner', owner);

  it('reports that a new owner still has to set up their profile', async () => {
    const res = await get(ownerName('new')).expect(200);
    expect(res.body.profileSetupRequired).toBe(true);
  });
});
