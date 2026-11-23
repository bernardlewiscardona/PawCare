import { Injectable } from '@nestjs/common';
import { Prisma, type AccountStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ResolvedOwner {
  id: string;
  accountStatus: AccountStatus;
}

@Injectable()
export class OwnerIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds the owner for a development subject (`dev:<name>`), creating it on first use with
   * placeholder profile values that PF-01 lets the owner change. Safe under concurrent first
   * requests: auth_subject is unique, and a request that loses the race reads the winner's row.
   */
  async resolveDevOwner(subject: string): Promise<ResolvedOwner> {
    const select = { id: true, accountStatus: true } as const;
    try {
      return await this.prisma.owner.upsert({
        where: { authSubject: subject },
        create: {
          authSubject: subject,
          displayName: `Dev owner ${subject.slice('dev:'.length)}`,
          timeZone: 'UTC',
        },
        update: {},
        select,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.owner.findUniqueOrThrow({ where: { authSubject: subject }, select });
      }
      throw error;
    }
  }
}
