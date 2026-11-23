import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { fieldErrorsFrom, validationFailed } from './common/errors/validation.js';

/**
 * Global HTTP setup shared by main.ts and the e2e tests, so tests exercise exactly what ships.
 * Feature routes live under /v1/...; health endpoints are version-neutral (/health).
 */
export function configureApp(app: INestApplication): INestApplication {
  app.use(helmet());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => validationFailed(fieldErrorsFrom(errors)),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
