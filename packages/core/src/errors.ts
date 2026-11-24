/**
 * Stable, machine-readable error codes. The mobile app branches on `code`, never on `message`.
 * Never rename or remove a code that a released app may depend on; add new ones instead.
 */
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  /** 409: an Idempotency-Key was already used for a request with a different body. */
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  /** 409: the owner must finish profile setup (PF-01) first, e.g. before adding a pet. */
  PROFILE_SETUP_REQUIRED: 'PROFILE_SETUP_REQUIRED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Messages per request field, e.g. { phone: ['Enter the number with its country code…'] }. */
export type FieldErrors = Record<string, string[]>;

/** A field rule's rejection, carrying the message shown next to the field. */
export interface RuleError {
  error: string;
}

export function isRuleError(value: unknown): value is RuleError {
  return typeof value === 'object' && value !== null && 'error' in value;
}
