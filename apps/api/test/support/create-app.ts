import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { AUTH_MODE } from '../../src/auth/auth-mode.js';
import type { AuthMode } from '../../src/config/env.validation.js';

/** The real app, wired exactly as main.ts does, with the auth mode chosen per spec file. */
export async function createApp(mode: AuthMode): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AUTH_MODE)
    .useValue(mode)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
