import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PAGE_LIMIT } from '@pawcare/core';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PetResponseDto } from './pet-response.dto.js';

export class ListPetsQueryDto {
  @ApiPropertyOptional({
    default: PAGE_LIMIT.default,
    minimum: PAGE_LIMIT.min,
    maximum: PAGE_LIMIT.max,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGE_LIMIT.min)
  @Max(PAGE_LIMIT.max)
  limit?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'nextCursor from the previous page' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

/** One page of active pets, oldest first. nextCursor is null on the last page. */
export class PetListResponseDto {
  @ApiProperty({ type: [PetResponseDto] })
  data!: PetResponseDto[];

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  nextCursor!: string | null;
}
