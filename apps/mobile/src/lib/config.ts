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
