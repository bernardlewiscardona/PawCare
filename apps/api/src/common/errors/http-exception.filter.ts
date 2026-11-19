import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppException } from './app.exception.js';
import { ErrorCode, type ErrorBody } from './error-codes.js';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  429: ErrorCode.TOO_MANY_REQUESTS,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

/**
 * Converts every error into { statusCode, code, message, details }.
 * Unexpected errors become a generic 500: no stack traces, SQL or config values reach the client,
 * and only the error class name is logged (messages may contain health data or connection strings).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details ?? null,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const validationMessages =
        statusCode === 400 && typeof response === 'object' && response !== null
          ? (response as { message?: unknown }).message
          : undefined;

      if (Array.isArray(validationMessages)) {
        return {
          statusCode,
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Request validation failed',
          details: { errors: validationMessages },
        };
      }
      return {
        statusCode,
        code: CODE_BY_STATUS[statusCode] ?? ErrorCode.BAD_REQUEST,
        message: exception.message,
        details: null,
      };
    }

    const name = exception instanceof Error ? exception.constructor.name : typeof exception;
    this.logger.error(`Unhandled ${name}`);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Something went wrong',
      details: null,
    };
  }
}
