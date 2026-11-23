import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentOwner } from '../auth/current-owner.decorator.js';
import { OwnerResponseDto } from './dto/owner-response.dto.js';
import { OwnersService } from './owners.service.js';

@ApiTags('owners')
@ApiSecurity('dev-owner')
@Controller('me')
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  /** The signed-in owner's profile. */
  @Get()
  @ApiOkResponse({ type: OwnerResponseDto })
  @ApiUnauthorizedResponse({ description: 'No owner identity (code UNAUTHORIZED)' })
  getMe(@CurrentOwner() ownerId: string): Promise<OwnerResponseDto> {
    return this.owners.getProfile(ownerId);
  }
}
