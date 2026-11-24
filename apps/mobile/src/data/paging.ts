import { PAGE_LIMIT, type FieldErrors } from '@pawcare/core';
import { DataError, validationFailed } from './errors';

/** IDs are UUIDv7; anything else is answered as not found, never looked up. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PAGE_SIZE_MESSAGE = 'Choose a page size of 1–100.';
export const CURSOR_MESSAGE = 'Use the nextCursor from the previous page.';

/** Checks `limit` (1–100, default 20) and the cursor's form; one VALIDATION_FAILED for both. */
export function parsePageQuery(query: { limit?: number; cursor?: string }): {
  limit: number;
  cursor?: string;
} {
  const errors: FieldErrors = {};
  const { limit = PAGE_LIMIT.default, cursor } = query;
  if (!Number.isInteger(limit) || limit < PAGE_LIMIT.min || limit > PAGE_LIMIT.max) {
    errors.limit = [PAGE_SIZE_MESSAGE];
  }
  if (cursor !== undefined && !(typeof cursor === 'string' && UUID.test(cursor))) {
    errors.cursor = [CURSOR_MESSAGE];
  }
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return { limit, cursor };
}

/** A well-formed cursor that doesn't name a row in this list: same message as a malformed one. */
export function badCursor(): DataError {
  return validationFailed({ cursor: [CURSOR_MESSAGE] });
}
