import { ApiProperty } from '@nestjs/swagger';
import type { Owner } from '../../generated/prisma/client.js';

/** The current owner's profile. Never exposes auth_subject or account status. */
export class OwnerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Bea Santos' })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  phone!: string | null;

  @ApiProperty({ example: 'Asia/Manila', description: 'IANA time zone' })
  timeZone!: string;

  @ApiProperty({ example: 1, description: 'Send back on edits for conflict detection' })
  version!: number;

  static from(owner: Owner): OwnerResponseDto {
    return {
      id: owner.id,
      displayName: owner.displayName,
      phone: owner.phone,
      timeZone: owner.timeZone,
      version: owner.version,
    };
  }
}
