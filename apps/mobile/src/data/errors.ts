import { ErrorCode, type FieldErrors } from '@pawcare/core';

/** The phone's counterpart of the API's error envelope: screens branch on `code`, never `message`. */
export class DataError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

export function validationFailed(fields: FieldErrors): DataError {
  return new DataError(ErrorCode.VALIDATION_FAILED, 'Request validation failed', {
    errors: Object.values(fields).flat(),
    fields,
  });
}

export function notFound(): DataError {
  return new DataError(ErrorCode.NOT_FOUND, 'Not found');
}

export function conflict(message: string, current: unknown): DataError {
  return new DataError(ErrorCode.CONFLICT, message, { current });
}

export function profileSetupRequired(message = 'Finish setting up your profile first.'): DataError {
  return new DataError(ErrorCode.PROFILE_SETUP_REQUIRED, message);
}

/**
 * A warning the owner can override: the screen shows `details.warnings` per field and resends
 * with the named `confirm…` flag (MR-01: `confirmBeforeBirth`).
 */
export function confirmationRequired(warnings: FieldErrors): DataError {
  return new DataError(ErrorCode.CONFIRMATION_REQUIRED, 'Confirmation required', { warnings });
}
