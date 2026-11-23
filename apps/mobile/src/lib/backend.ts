import { createApiClient } from './api';
import { apiBaseUrl, devOwner } from './config';

/** The app's API client. Feature tickets use this as they move screens off the demo store. */
export const api = createApiClient({ baseUrl: apiBaseUrl, devOwner });
