import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function createApp(prismaOverride?: Partial<PrismaService>): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (prismaOverride) {
    builder = builder.overrideProvider(PrismaService).useValue(prismaOverride);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Health (e2e)', () => {
  describe('with a reachable database', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createApp();
    });
    afterAll(async () => {
      await app.close();
    });

    it('GET /health reports the process is alive', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /health/ready checks the real database', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(res.body).toEqual({ status: 'ok', checks: { database: 'up' } });
    });

    it('unknown routes return the standard error shape', async () => {
      const res = await request(app.getHttpServer()).get('/v1/does-not-exist').expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: expect.any(String),
        details: null,
      });
    });

    it('sets security headers', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('with an unreachable database', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createApp({
        isHealthy: async () => false,
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      });
    });
    afterAll(async () => {
      await app.close();
    });

    it('GET /health/ready returns 503 and does not report readiness', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
      expect(res.body).toEqual({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service not ready',
        details: { checks: { database: 'down' } },
      });
    });

    it('GET /health still reports the process is alive', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });

    it('never exposes connection details or secrets', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready');
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/postgres|password|DATABASE_URL|localhost|5432/i);
    });
  });
});
