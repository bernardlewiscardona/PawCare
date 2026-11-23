import Constants from 'expo-constants';
import { resolveApiBaseUrl } from './connectivity';

/**
 * Public, bundled configuration only. EXPO_PUBLIC_* values ship inside the app binary,
 * so nothing secret may ever be read here.
 */
export const apiBaseUrl = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  __DEV__ ? Constants.expoConfig?.hostUri : undefined,
);

/**
 * Development owner name, sent as the X-Dev-Owner header while sign-in is postponed (AUTH-01
 * replaces it with Google sign-in). Public by design: the API accepts it only in AUTH_MODE=dev.
 */
export const devOwner = process.env.EXPO_PUBLIC_DEV_OWNER?.trim() || undefined;
