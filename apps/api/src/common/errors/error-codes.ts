import { ErrorCode } from '@pawcare/core';

export { ErrorCode };

/** Standard error body for every non-2xx response. */
export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}
