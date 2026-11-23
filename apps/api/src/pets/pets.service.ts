import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { isRuleError } from '../common/errors/rule-error.js';
import { type FieldErrors, validationFailed } from '../common/errors/validation.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import { localDate } from '../common/time/local-date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePetDto } from './dto/create-pet.dto.js';
import type { ListPetsQueryDto, PetListResponseDto } from './dto/list-pets-query.dto.js';
import { PetResponseDto } from './dto/pet-response.dto.js';
import {
  checkPastOrToday,
  normalizeMicrochip,
  normalizeOptionalText,
  normalizePetName,
  toKilograms,
} from './pet-rules.js';

const IDEMPOTENCY_KEY = /^[\x21-\x7E]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 20;

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

  async create(
    ownerId: string,
    key: string | undefined,
    dto: CreatePetDto,
  ): Promise<PetResponseDto> {
    if (key === undefined || !IDEMPOTENCY_KEY.test(key)) {
      throw validationFailed({
        'Idempotency-Key': ['Send an Idempotency-Key header of 1–100 visible characters.'],
      });
    }
    const owner = await this.prisma.owner.findUniqueOrThrow({
      where: { id: ownerId },
      select: { timeZone: true },
    });
    const today = localDate(owner.timeZone);
    const input = normalizePet(dto, today);

    const petId = await this.idempotency.execute(
      { ownerId, operation: 'pet.create', key, payload: input },
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

/** Applies every field rule, collecting all failures into one 400. */
function normalizePet(dto: CreatePetDto, today: string): PetInput {
  const errors: FieldErrors = {};
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
    take('currentWeightKg', toKilograms(dto.weight.value, dto.weight.unit));
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

  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return input;
}

const toDate = (value: string | undefined) =>
  value === undefined ? undefined : new Date(`${value}T00:00:00Z`);
