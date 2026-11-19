import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.validation.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
    });
  }

  /**
   * Try to connect at startup. If the database is down the API still starts, logs a clear
   * warning, and /health/ready reports "down" until the database becomes reachable.
   */
  async onModuleInit(): Promise<void> {
    if (await this.isHealthy()) {
      this.logger.log('Connected to PostgreSQL');
    } else {
      this.logger.warn(
        'PostgreSQL is not reachable. Is it running (pnpm db:up) and is DATABASE_URL correct? ' +
          '/health/ready will report the database as down.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** True when a trivial query succeeds. Never throws and never exposes error details. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
