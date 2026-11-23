/**
 * Development-only owner identity (AUTH_MODE=dev). Until Google sign-in exists (AUTH-01), the
 * caller names their owner in this header. The value is never logged.
 */
export const DEV_OWNER_HEADER = 'x-dev-owner';

const DEV_OWNER_NAME = /^[A-Za-z0-9_-]{1,64}$/;

/** The owner's auth_subject for a header value, or null when the value isn't acceptable. */
export function devSubjectFromHeader(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || !DEV_OWNER_NAME.test(value)) return null;
  return `dev:${value}`;
}
