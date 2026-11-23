import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** The owner resolved by OwnerAuthGuard. Always taken from the identity, never from the client. */
export interface CurrentOwnerContext {
  id: string;
}

export interface OwnerRequest extends Request {
  owner?: CurrentOwnerContext;
}

/** Injects the current owner's ID into a controller method: `@CurrentOwner() ownerId: string`. */
export const CurrentOwner = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const owner = ctx.switchToHttp().getRequest<OwnerRequest>().owner;
  if (!owner) {
    // Only reachable if a route marked @Public() asks for the owner: a programming error.
    throw new Error('CurrentOwner used on a route without an owner identity');
  }
  return owner.id;
});
