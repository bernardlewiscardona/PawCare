import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * PATCH /v1/me. Send only the fields that change, plus the version last read. The first save
 * (while profileSetupRequired is true) must include displayName and timeZone.
 */
export class UpdateOwnerProfileDto {
  @ApiProperty({ example: 1, description: 'The version of the profile you last read' })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 'Bea Santos', description: '1–100 characters, trimmed' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'Asia/Manila', description: 'IANA time zone, or UTC' })
  @IsOptional()
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
}
