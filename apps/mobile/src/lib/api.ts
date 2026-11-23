type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Codes raised by the app itself, alongside the API's own codes (e.g. UNAUTHORIZED). */
export type ClientErrorCode = 'NOT_CONFIGURED' | 'NETWORK_ERROR' | 'HTTP_ERROR';

/** Any failed API call. Branch on `code`, never on `message`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string | null;
  /** Development owner name (EXPO_PUBLIC_DEV_OWNER), sent as X-Dev-Owner until sign-in exists. */
  devOwner?: string;
  fetchFn?: FetchFn;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

export function createApiClient({
  baseUrl,
  devOwner,
  fetchFn = fetch,
}: ApiClientOptions): ApiClient {
  return {
    async request<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
      if (!baseUrl) {
        throw new ApiError(0, 'NOT_CONFIGURED', 'The API address is not configured');
      }
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (devOwner) headers['X-Dev-Owner'] = devOwner;
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      let res: Response;
      try {
        res = await fetchFn(`${baseUrl}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach PawCare');
      }

      const payload: unknown = await res.json().catch(() => undefined);
      if (res.ok) return payload as T;
      throw toApiError(res.status, payload);
    },
  };
}

function toApiError(status: number, payload: unknown): ApiError {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { code?: unknown }).code === 'string' &&
    typeof (payload as { message?: unknown }).message === 'string'
  ) {
    const { code, message, details } = payload as {
      code: string;
      message: string;
      details?: unknown;
    };
    return new ApiError(status, code, message, details ?? null);
  }
  return new ApiError(status, 'HTTP_ERROR', 'Unexpected response from PawCare');
}
