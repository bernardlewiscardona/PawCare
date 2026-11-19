import { Controller, Get, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Unversioned, unauthenticated health endpoints. Responses contain status words only:
 * no versions, hostnames, connection strings or error messages.
 */
@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up and serving HTTP. Does not touch the database. */
  @Get()
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: the API can serve requests that need the database. */
  @Get('ready')
  @ApiOkResponse({ schema: { example: { status: 'ok', checks: { database: 'up' } } } })
  @ApiServiceUnavailableResponse({ description: 'A dependency is down' })
  async ready(): Promise<{ status: 'ok'; checks: { database: 'up' } }> {
    if (!(await this.prisma.isHealthy())) {
      throw new AppException(
        ErrorCode.SERVICE_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
        'Service not ready',
        { checks: { database: 'down' } },
      );
    }
    return { status: 'ok', checks: { database: 'up' } };
  }
}
