import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentOwner } from '../auth/current-owner.decorator.js';
import { CreatePetDto } from './dto/create-pet.dto.js';
import { ListPetsQueryDto, PetListResponseDto } from './dto/list-pets-query.dto.js';
import { PetResponseDto } from './dto/pet-response.dto.js';
import { PetsService } from './pets.service.js';

@ApiTags('pets')
@ApiSecurity('dev-owner')
@Controller('pets')
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  /** Registers a pet. Retrying with the same Idempotency-Key returns the same pet. */
  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'A new value per pet' })
  @ApiCreatedResponse({ type: PetResponseDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED; messages per field in details.fields' })
  @ApiConflictResponse({ description: 'IDEMPOTENCY_KEY_REUSED: key used for a different pet' })
  @ApiUnauthorizedResponse({ description: 'No owner identity (code UNAUTHORIZED)' })
  create(
    @CurrentOwner() ownerId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreatePetDto,
  ): Promise<PetResponseDto> {
    return this.pets.create(ownerId, key, dto);
  }

  /** The owner's active pets, oldest first, paginated with nextCursor. */
  @Get()
  @ApiOkResponse({ type: PetListResponseDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED on limit or cursor' })
  list(
    @CurrentOwner() ownerId: string,
    @Query() query: ListPetsQueryDto,
  ): Promise<PetListResponseDto> {
    return this.pets.list(ownerId, query);
  }

  /** One of the owner's pets, including archived ones. */
  @Get(':id')
  @ApiOkResponse({ type: PetResponseDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND: no such pet for this owner' })
  get(@CurrentOwner() ownerId: string, @Param('id') id: string): Promise<PetResponseDto> {
    return this.pets.get(ownerId, id);
  }
}
