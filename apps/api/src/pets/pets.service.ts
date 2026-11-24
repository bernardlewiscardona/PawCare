import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PAGE_LIMIT,
  checkPastOrToday,
  isRuleError,
  localDate,
  normalizeMicrochip,
  normalizeOptionalText,
  normalizePetName,
  toGrams,
} from '@pawcare/core';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { type FieldErrors, validationFailed } from '../common/errors/validation.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import { validateBody } from '../common/validation/validate-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePetDto } from './dto/create-pet.dto.js';
import type { ListPetsQueryDto, PetListResponseDto } from './dto/list-pets-query.dto.js';
import { PetResponseDto } from './dto/pet-response.dto.js';

const IDEMPOTENCY_KEY = /^[\x21-\x7E]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = PAGE_LIMIT.default;

/** Validated pet fields, before defaults. This is also what a retry must repeat exactly. */
interface PetInput {
  name: string;
  species: CreatePetDto['species'];
  speciesOther?: string;
  breed?: string;
  sex?: CreatePetDto['sex'];
  birthDate?: string;
  birthDateEstimated?: boolean;
  currentWeightKg?: number;
  weightMeasuredOn?: string;
  microchip?: string;
}

@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(ownerId: string, key: string | undefined, body: unknown): Promise<PetResponseDto> {
    const owner = await this.prisma.owner.findUniqueOrThrow({
      where: { id: ownerId },
      select: { timeZone: true, profileCompletedAt: true },
    });
    // "Today" is the owner's date, so their time zone must be set first (PF-01 setup).
    if (owner.profileCompletedAt === null) {
      throw new AppException(
        ErrorCode.PROFILE_SETUP_REQUIRED,
        HttpStatus.CONFLICT,
        'Finish setting up your profile before adding a pet.',
      );
    }
    const today = localDate(owner.timeZone);
    const { key: requestKey, pet: input } = parseCreate(key, body, today);

    const petId = await this.idempotency.execute(
      { ownerId, operation: 'pet.create', key: requestKey, payload: input },
      async (tx) => {
        const measuredOn =
          input.currentWeightKg === undefined ? undefined : (input.weightMeasuredOn ?? today);
        const pet = await tx.pet.create({
          data: {
            ownerId,
            name: input.name,
            species: input.species,
            speciesOther: input.speciesOther,
            breed: input.breed,
            sex: input.sex,
            birthDate: toDate(input.birthDate),
            birthDateEstimated: input.birthDateEstimated,
            currentWeightKg: input.currentWeightKg,
            weightMeasuredOn: toDate(measuredOn),
            microchip: input.microchip,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorOwnerId: ownerId,
            action: 'pet.created',
            objectType: 'pet',
            objectId: pet.id,
            changeMetadata: { fields: Object.keys(input) },
          },
        });
        await tx.outboxEvent.create({
          data: {
            ownerId,
            eventType: 'pet.created',
            aggregateType: 'pet',
            aggregateId: pet.id,
            aggregateVersion: pet.version,
            payload: { petId: pet.id },
          },
        });
        return pet.id;
      },
    );

    return this.get(ownerId, petId);
  }

  /** Active pets, oldest first (UUIDv7 order), one page at a time. */
  async list(ownerId: string, query: ListPetsQueryDto): Promise<PetListResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const pets = await this.prisma.pet.findMany({
      where: {
        ownerId,
        archivedAt: null,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const page = pets.slice(0, limit);
    return {
      data: page.map((pet) => PetResponseDto.from(pet)),
      nextCursor: pets.length > limit ? page[page.length - 1].id : null,
    };
  }

  /** One pet, archived or not. Another owner's pet and a missing one are the same 404. */
  async get(ownerId: string, id: string): Promise<PetResponseDto> {
    const pet = UUID.test(id) ? await this.prisma.pet.findFirst({ where: { id, ownerId } }) : null;
    if (!pet) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, 'Not found');
    return PetResponseDto.from(pet);
  }
}

/**
 * Checks the key header, the body's types and every field rule, and reports all failures in one
 * 400. Weight errors from the body's types (weight.value, weight.unit) go under `weight`, like
 * the range error, so the app maps them to one input.
 */
function parseCreate(
  key: string | undefined,
  body: unknown,
  today: string,
): { key: string; pet: PetInput } {
  const errors: FieldErrors = {};
  if (key === undefined || !IDEMPOTENCY_KEY.test(key)) {
    errors['Idempotency-Key'] = ['Send an Idempotency-Key header of 1–100 visible characters.'];
  }
  const { value: dto, errors: typeErrors } = validateBody(CreatePetDto, body);
  for (const [path, messages] of Object.entries(typeErrors)) {
    const field = path.startsWith('weight.') ? 'weight' : path;
    errors[field] = [...(errors[field] ?? []), ...messages];
  }
  const pet = Object.keys(typeErrors).length === 0 ? normalizePet(dto, today, errors) : undefined;
  if (pet === undefined || key === undefined || Object.keys(errors).length > 0) {
    throw validationFailed(errors);
  }
  return { key, pet };
}

/** Applies every field rule, adding failures to `errors`. */
function normalizePet(dto: CreatePetDto, today: string, errors: FieldErrors): PetInput {
  const input: PetInput = { name: '', species: dto.species };
  const take = <K extends keyof PetInput>(field: K, result: PetInput[K] | { error: string }) => {
    if (isRuleError(result)) errors[field] = [result.error];
    else input[field] = result as PetInput[K];
  };

  take('name', normalizePetName(dto.name));
  if (dto.species === 'OTHER') {
    take(
      'speciesOther',
      normalizeOptionalText(
        dto.speciesOther ?? '',
        100,
        'Describe the species in 1–100 characters.',
      ),
    );
  } else if (dto.speciesOther !== undefined) {
    errors.speciesOther = ['Only add a description when the species is Other.'];
  }
  if (dto.breed !== undefined) {
    take('breed', normalizeOptionalText(dto.breed, 100, 'Enter a breed of 1–100 characters.'));
  }
  if (dto.sex !== undefined) input.sex = dto.sex;
  if (dto.birthDate !== undefined) {
    take(
      'birthDate',
      checkPastOrToday(dto.birthDate, today, "The birth date can't be in the future."),
    );
  }
  if (dto.birthDateEstimated !== undefined) {
    if (dto.birthDateEstimated && dto.birthDate === undefined) {
      errors.birthDateEstimated = ['Add a birth date to mark it as estimated.'];
    } else {
      input.birthDateEstimated = dto.birthDateEstimated;
    }
  }
  if (dto.weight !== undefined) {
    const grams = toGrams(dto.weight.value, dto.weight.unit);
    take('currentWeightKg', isRuleError(grams) ? grams : grams / 1000);
    if (errors.currentWeightKg) {
      errors.weight = errors.currentWeightKg;
      delete errors.currentWeightKg;
    }
  }
  if (dto.weightMeasuredOn !== undefined) {
    if (dto.weight === undefined) {
      errors.weightMeasuredOn = ['Add a weight for this measurement date.'];
    } else {
      take(
        'weightMeasuredOn',
        checkPastOrToday(
          dto.weightMeasuredOn,
          today,
          "The measurement date can't be in the future.",
        ),
      );
    }
  }
  if (dto.microchip !== undefined) take('microchip', normalizeMicrochip(dto.microchip));
  return input;
}

const toDate = (value: string | undefined) =>
  value === undefined ? undefined : new Date(`${value}T00:00:00Z`);
