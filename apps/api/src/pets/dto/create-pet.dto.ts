import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsString, ValidateNested } from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.js';

export const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'] as const;
export const SEXES = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
export const WEIGHT_UNITS = ['KG', 'LB'] as const;

export class WeightInputDto {
  @ApiProperty({ example: 4.2 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value!: number;

  @ApiProperty({ enum: WEIGHT_UNITS, example: 'KG' })
  @IsIn(WEIGHT_UNITS)
  unit!: (typeof WEIGHT_UNITS)[number];
}

/** POST /v1/pets. Only name and species are required. */
export class CreatePetDto {
  @ApiProperty({ example: 'Mochi', description: '1–100 characters, trimmed' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: SPECIES })
  @IsIn(SPECIES)
  species!: (typeof SPECIES)[number];

  @ApiPropertyOptional({ example: 'Tortoise', description: 'Required when species is OTHER' })
  @IfPresent()
  @IsString()
  speciesOther?: string;

  @ApiPropertyOptional({ example: 'Aspin' })
  @IfPresent()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({ enum: SEXES, default: 'UNKNOWN' })
  @IfPresent()
  @IsIn(SEXES)
  sex?: (typeof SEXES)[number];

  @ApiPropertyOptional({ example: '2021-03-14', description: 'YYYY-MM-DD, not in the future' })
  @IfPresent()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional({ default: false })
  @IfPresent()
  @IsBoolean()
  birthDateEstimated?: boolean;

  @ApiPropertyOptional({ type: WeightInputDto, description: 'Stored in kg' })
  @IfPresent()
  @ValidateNested()
  @Type(() => WeightInputDto)
  weight?: WeightInputDto;

  @ApiPropertyOptional({ example: '2026-11-20', description: "Defaults to the owner's today" })
  @IfPresent()
  @IsString()
  weightMeasuredOn?: string;

  @ApiPropertyOptional({ example: '985112345678901', description: '1–50 letters or digits' })
  @IfPresent()
  @IsString()
  microchip?: string;
}
