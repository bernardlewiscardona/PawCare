import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes.js';

/** Throw this from services to return a specific, stable error code to the app. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message: string,
    readonly details: unknown = null,
  ) {
    super({ code, message, details }, status);
  }
}
