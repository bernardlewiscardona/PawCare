import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { authModeProvider } from './auth-mode.js';
import { OwnerAuthGuard } from './owner-auth.guard.js';
import { OwnerIdentityService } from './owner-identity.service.js';

/** Resolves the current owner for every request (FN-01). Google sign-in (AUTH-01) plugs in here. */
@Module({
  providers: [
    authModeProvider,
    OwnerIdentityService,
    { provide: APP_GUARD, useClass: OwnerAuthGuard },
  ],
})
export class AuthModule {}
