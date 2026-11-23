import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import { Prisma, type IdempotencyRequest } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface IdempotentRequest {
  ownerId: string;
  /** Stable operation name, e.g. 'pet.create'. */
  operation: string;
  /** The client's Idempotency-Key header. */
  key: string;
  /** The normalised request; retries must produce the same value. */
  payload: unknown;
}

/**
 * Makes creates safe to retry (shared requirement 2). The first request with a key runs
 * `create` and records the resulting resource ID in the same transaction; a retry with the same
 * key and payload returns that ID instead. Keys last 24 hours.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    request: IdempotentRequest,
    create: (tx: Prisma.TransactionClient) => Promise<string>,
  ): Promise<string> {
    const { ownerId, operation, key } = request;
    const payloadHash = hashPayload(request.payload);
    const where = { ownerId_operation_requestKey: { ownerId, operation, requestKey: key } };

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyRequest.deleteMany({
          where: { ownerId, operation, requestKey: key, expiresAt: { lte: new Date() } },
        });
        const existing = await tx.idempotencyRequest.findUnique({ where });
        if (existing) return replay(existing, payloadHash);

        const row = await tx.idempotencyRequest.create({
          data: {
            ownerId,
            operation,
            requestKey: key,
            payloadHash,
            expiresAt: new Date(Date.now() + KEY_LIFETIME_MS),
          },
        });
        const resourceId = await create(tx);
        await tx.idempotencyRequest.update({
          where: { id: row.id },
          data: { state: 'COMPLETED', resultReference: resourceId },
        });
        return resourceId;
      });
    } catch (error) {
      // A simultaneous request with the same key committed first; answer as its retry.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.idempotencyRequest.findUnique({ where });
        if (winner) return replay(winner, payloadHash);
      }
      throw error;
    }
  }
}

function replay(existing: IdempotencyRequest, payloadHash: string): string {
  if (existing.payloadHash !== payloadHash) {
    throw new AppException(
      ErrorCode.IDEMPOTENCY_KEY_REUSED,
      HttpStatus.CONFLICT,
      'This request key was already used for a different request.',
    );
  }
  if (!existing.resultReference) {
    // Only committed (completed) rows are visible, so this means a failed earlier attempt.
    throw new AppException(ErrorCode.CONFLICT, HttpStatus.CONFLICT, 'Request is still in progress');
  }
  return existing.resultReference;
}

/** SHA-256 of the payload with object keys sorted, so key order never changes the hash. */
export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
