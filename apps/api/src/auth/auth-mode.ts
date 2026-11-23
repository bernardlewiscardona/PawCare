import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthMode, Env } from '../config/env.validation.js';

/** Injection token for the active AuthMode (from AUTH_MODE). Tests override it per app. */
export const AUTH_MODE = Symbol('AUTH_MODE');

export const authModeProvider: Provider<AuthMode> = {
  provide: AUTH_MODE,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => config.get('AUTH_MODE', { infer: true }),
};
