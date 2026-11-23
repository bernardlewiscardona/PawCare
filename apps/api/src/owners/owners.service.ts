import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { type FieldErrors, validationFailed } from '../common/errors/validation.js';
import type { Owner } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnerResponseDto } from './dto/owner-response.dto.js';
import type { UpdateOwnerProfileDto } from './dto/update-owner-profile.dto.js';
import {
  checkTimeZone,
  normalizeDisplayName,
  normalizePhone,
  type RuleError,
} from './profile-rules.js';

const PROFILE_FIELDS = ['displayName', 'phone', 'timeZone'] as const;
type ProfileField = (typeof PROFILE_FIELDS)[number];
type ProfileChanges = Partial<Pick<Owner, ProfileField>>;

const SETUP_FIELD_MESSAGE = 'Required to finish setting up your profile.';

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(ownerId: string): Promise<OwnerResponseDto> {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, 'Not found');
    return OwnerResponseDto.from(owner);
  }

  /**
   * Saves profile fields when `version` matches the stored one; otherwise 409 with the current
   * profile. The first save completes setup. The update, its audit event and its outbox event
   * commit together, and record field names only.
   */
  async updateProfile(ownerId: string, dto: UpdateOwnerProfileDto): Promise<OwnerResponseDto> {
    const changes = normalizeChanges(dto);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.owner.findUniqueOrThrow({ where: { id: ownerId } });
      const setupRequired = current.profileCompletedAt === null;

      if (setupRequired) {
        const missing: FieldErrors = {};
        if (changes.displayName === undefined) missing.displayName = [SETUP_FIELD_MESSAGE];
        if (changes.timeZone === undefined) missing.timeZone = [SETUP_FIELD_MESSAGE];
        if (Object.keys(missing).length > 0) throw validationFailed(missing);
      }

      const changedFields = PROFILE_FIELDS.filter(
        (field) => changes[field] !== undefined && changes[field] !== current[field],
      );
      if (changedFields.length === 0 && !setupRequired) {
        if (current.version === dto.version) return OwnerResponseDto.from(current);
        throw conflict(current);
      }

      const data: ProfileChanges = {};
      for (const field of changedFields) Object.assign(data, { [field]: changes[field] });
      const { count } = await tx.owner.updateMany({
        where: { id: ownerId, version: dto.version },
        data: {
          ...data,
          version: { increment: 1 },
          ...(setupRequired ? { profileCompletedAt: new Date() } : {}),
        },
      });
      if (count === 0) {
        throw conflict(await tx.owner.findUniqueOrThrow({ where: { id: ownerId } }));
      }

      const updated = await tx.owner.findUniqueOrThrow({ where: { id: ownerId } });
      await tx.auditEvent.create({
        data: {
          actorOwnerId: ownerId,
          action: 'owner.profile_updated',
          objectType: 'owner',
          objectId: ownerId,
          changeMetadata: { fields: changedFields },
        },
      });
      await tx.outboxEvent.create({
        data: {
          ownerId,
          eventType: 'owner.profile_updated',
          aggregateType: 'owner',
          aggregateId: ownerId,
          aggregateVersion: updated.version,
          payload: {
            changedFields,
            timeZoneChanged: changedFields.includes('timeZone'),
            setupCompleted: setupRequired,
          },
        },
      });
      return OwnerResponseDto.from(updated);
    });
  }
}

/** Applies the field rules to every field present; throws one 400 listing all failures. */
function normalizeChanges(dto: UpdateOwnerProfileDto): ProfileChanges {
  const changes: ProfileChanges = {};
  const errors: FieldErrors = {};
  const apply = <T>(field: ProfileField, result: T | RuleError) => {
    if (isRuleError(result)) errors[field] = [result.error];
    else Object.assign(changes, { [field]: result });
  };
  if (dto.displayName !== undefined) apply('displayName', normalizeDisplayName(dto.displayName));
  if (dto.phone !== undefined) apply('phone', normalizePhone(dto.phone));
  if (dto.timeZone !== undefined) apply('timeZone', checkTimeZone(dto.timeZone));
  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return changes;
}

function isRuleError(value: unknown): value is RuleError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

function conflict(current: Owner): AppException {
  return new AppException(
    ErrorCode.CONFLICT,
    HttpStatus.CONFLICT,
    'This profile was changed elsewhere. Review the latest version and try again.',
    { current: OwnerResponseDto.from(current) },
  );
}
