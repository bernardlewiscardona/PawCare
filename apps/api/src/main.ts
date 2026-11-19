import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  // Imported here, not statically: ConfigModule validates the environment while the module
  // loads, and this keeps that failure inside the try/catch below.
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const host = config.get('HOST', { infer: true });

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('PawCare API').setVersion('1').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, doc);
  }

  await app.listen(port, host);
  Logger.log(`PawCare API listening on port ${port}`, 'Bootstrap');
}

try {
  await bootstrap();
} catch (error) {
  // Env validation errors are written to be safe to print; anything else is reduced to its type.
  const message =
    error instanceof Error && error.message.startsWith('Invalid API environment configuration')
      ? error.message
      : `Startup failed: ${error instanceof Error ? error.constructor.name : 'unknown error'}`;
  console.error(message);
  process.exit(1);
}
