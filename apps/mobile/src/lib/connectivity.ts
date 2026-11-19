export type ConnectivityResult =
  | { state: 'ready' }
  | { state: 'database-down' }
  | { state: 'unreachable' }
  | { state: 'not-configured' };

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const API_PORT = 3000;
const TIMEOUT_MS = 5000;

/**
 * Picks the API base URL. An explicit EXPO_PUBLIC_API_URL wins; otherwise, in development, use
 * the machine running the Expo dev server (its LAN address), so a physical phone on the same
 * Wi-Fi reaches the API without extra setup. A phone's own "localhost" is the phone itself.
 */
export function resolveApiBaseUrl(
  configuredUrl: string | undefined,
  devServerHostUri: string | undefined,
): string | null {
  const configured = configuredUrl?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const host = devServerHostUri?.split(':')[0];
  return host ? `http://${host}:${API_PORT}` : null;
}

/** Development check that the API and its database are reachable. Never throws. */
export async function checkApiConnectivity(
  baseUrl: string | null,
  fetchFn: FetchFn = fetch,
): Promise<ConnectivityResult> {
  if (!baseUrl) {
    return { state: 'not-configured' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(`${baseUrl}/health/ready`, { signal: controller.signal });
    if (res.ok) return { state: 'ready' };
    if (res.status === 503) return { state: 'database-down' };
    return { state: 'unreachable' };
  } catch {
    return { state: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
