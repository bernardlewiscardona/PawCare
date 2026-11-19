import { describe, expect, it, vi } from 'vitest';
import { checkApiConnectivity, resolveApiBaseUrl } from './connectivity';

describe('resolveApiBaseUrl', () => {
  it('uses EXPO_PUBLIC_API_URL when set, without a trailing slash', () => {
    expect(resolveApiBaseUrl('http://10.0.2.2:3000/', '192.168.1.5:8081')).toBe(
      'http://10.0.2.2:3000',
    );
  });

  it('falls back to the dev server host on port 3000 (works for physical phones)', () => {
    expect(resolveApiBaseUrl(undefined, '192.168.1.5:8081')).toBe('http://192.168.1.5:3000');
  });

  it('ignores a blank configured URL', () => {
    expect(resolveApiBaseUrl('  ', '192.168.1.5:8081')).toBe('http://192.168.1.5:3000');
  });

  it('returns null when nothing is known', () => {
    expect(resolveApiBaseUrl(undefined, undefined)).toBeNull();
  });
});

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('checkApiConnectivity', () => {
  it('reports ready when the API and database are up', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(response(200, { status: 'ok', checks: { database: 'up' } }));
    await expect(checkApiConnectivity('http://api:3000', fetchFn)).resolves.toEqual({
      state: 'ready',
    });
    expect(fetchFn).toHaveBeenCalledWith('http://api:3000/health/ready', expect.anything());
  });

  it('reports database-down when the API answers 503', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        response(503, { code: 'SERVICE_UNAVAILABLE', details: { checks: { database: 'down' } } }),
      );
    await expect(checkApiConnectivity('http://api:3000', fetchFn)).resolves.toEqual({
      state: 'database-down',
    });
  });

  it('reports unreachable on a network error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(checkApiConnectivity('http://api:3000', fetchFn)).resolves.toEqual({
      state: 'unreachable',
    });
  });

  it('reports unreachable on an unexpected status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(500, {}));
    await expect(checkApiConnectivity('http://api:3000', fetchFn)).resolves.toEqual({
      state: 'unreachable',
    });
  });

  it('reports not-configured when there is no base URL', async () => {
    const fetchFn = vi.fn();
    await expect(checkApiConnectivity(null, fetchFn)).resolves.toEqual({
      state: 'not-configured',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
