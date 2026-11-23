import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { AuthMode } from '../config/env.validation.js';
import { AUTH_MODE } from './auth-mode.js';
import type { OwnerRequest } from './current-owner.decorator.js';
import { DEV_OWNER_HEADER, devSubjectFromHeader } from './dev-owner-header.js';
import { OwnerIdentityService } from './owner-identity.service.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Global guard: every route needs a current owner unless marked @Public(). Every failure gives
 * the same 401, so the response never says whether a header was missing, malformed, refused in
 * this mode, or belonged to an inactive account.
 */
@Injectable()
export class OwnerAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_MODE) private readonly mode: AuthMode,
    private readonly identity: OwnerIdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<OwnerRequest>();
    const subject =
      this.mode === 'dev' ? devSubjectFromHeader(request.headers[DEV_OWNER_HEADER]) : null;
    if (!subject) throw signInRequired();

    const owner = await this.identity.resolveDevOwner(subject);
    if (owner.accountStatus !== 'ACTIVE') throw signInRequired();

    request.owner = { id: owner.id };
    return true;
  }
}

function signInRequired(): AppException {
  return new AppException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, 'Sign-in required');
}
