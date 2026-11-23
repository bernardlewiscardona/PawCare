import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.js';

/** Largest value of a PostgreSQL integer column, such as owners.version. */
const MAX_INT4 = 2_147_483_647;

/**
 * PATCH /v1/me. Send only the fields that change, plus the version last read. The first save
 * (while profileSetupRequired is true) must include displayName and timeZone.
 */
export class UpdateOwnerProfileDto {
  @ApiProperty({ example: 1, description: 'The version of the profile you last read' })
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  version!: number;

  @ApiPropertyOptional({ example: 'Bea Santos', description: '1–100 characters, trimmed' })
  @IfPresent()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'Asia/Manila', description: 'IANA time zone, or UTC' })
  @IfPresent()
  @IsString()
  timeZone?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+63 917 123 4567',
    description: 'With country code; stored as E.164. null removes it',
  })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ enum: ['KG', 'LB'], description: 'Pet weight display unit' })
  @IfPresent()
  @IsIn(['KG', 'LB'])
  weightUnit?: 'KG' | 'LB';
}
