import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('createApiClient', () => {
  it('requests the path under the base URL and returns the parsed body', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { id: 'o1' }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    await expect(api.request('/v1/me')).resolves.toEqual({ id: 'o1' });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/v1/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('names the development owner when one is configured', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, {}));
    await createApiClient({ baseUrl: 'http://api.test', devOwner: 'bea', fetchFn }).request(
      '/v1/me',
    );
    expect(fetchFn.mock.calls[0][1]?.headers).toMatchObject({ 'X-Dev-Owner': 'bea' });
  });

  it('sends no owner header when none is configured', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, {}));
    await createApiClient({ baseUrl: 'http://api.test', fetchFn }).request('/v1/me');
    expect(fetchFn.mock.calls[0][1]?.headers).not.toHaveProperty('X-Dev-Owner');
  });

  it('sends a JSON body with its content type', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, {}));
    await createApiClient({ baseUrl: 'http://api.test', fetchFn }).request('/v1/me', {
      method: 'PATCH',
      body: { displayName: 'Bea' },
    });
    const init = fetchFn.mock.calls[0][1];
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe('{"displayName":"Bea"}');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('turns the standard error body into an ApiError the app can branch on', async () => {
    const body = {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Sign-in required',
      details: null,
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn: async () => jsonResponse(401, body),
    });

    const error = await api.request('/v1/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Sign-in required',
      details: null,
    });
  });

  it('reports an error response without the standard body as HTTP_ERROR', async () => {
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn: async () =>
        ({
          ok: false,
          status: 502,
          json: async () => Promise.reject(new SyntaxError()),
        }) as unknown as Response,
    });
    await expect(api.request('/v1/me')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('reports a failed connection as NETWORK_ERROR', async () => {
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn: async () => Promise.reject(new TypeError('Network request failed')),
    });
    await expect(api.request('/v1/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('reports a missing API URL as NOT_CONFIGURED without calling fetch', async () => {
    const fetchFn = vi.fn();
    const api = createApiClient({ baseUrl: null, fetchFn });
    await expect(api.request('/v1/me')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
