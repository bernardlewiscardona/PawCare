import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PetResponseDto } from './pet-response.dto.js';

export class ListPetsQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
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
