import { HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppException } from './app.exception.js';
import { ErrorCode } from './error-codes.js';

/** Messages per request field, e.g. { phone: ['Enter the number with its country code…'] }. */
export type FieldErrors = Record<string, string[]>;

/**
 * The 400 VALIDATION_FAILED error. details.errors is the flat list older clients read;
 * details.fields lets the app show each message next to its field.
 */
export function validationFailed(fields: FieldErrors): AppException {
  return new AppException(
    ErrorCode.VALIDATION_FAILED,
    HttpStatus.BAD_REQUEST,
    'Request validation failed',
    { errors: Object.values(fields).flat(), fields },
  );
}

/** Converts class-validator errors (from the global ValidationPipe) into FieldErrors. */
export function fieldErrorsFrom(errors: ValidationError[], parent = ''): FieldErrors {
  const fields: FieldErrors = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) fields[path] = Object.values(error.constraints);
    Object.assign(fields, fieldErrorsFrom(error.children ?? [], path));
  }
  return fields;
}
