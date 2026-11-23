import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentOwner } from '../auth/current-owner.decorator.js';
import { OwnerResponseDto } from './dto/owner-response.dto.js';
import { UpdateOwnerProfileDto } from './dto/update-owner-profile.dto.js';
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

  /** Saves profile changes. The first save (setup) must include displayName and timeZone. */
  @Patch()
  @ApiOkResponse({ type: OwnerResponseDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED; messages per field in details.fields' })
  @ApiConflictResponse({ description: 'CONFLICT: stale version; details.current is the latest' })
  @ApiUnauthorizedResponse({ description: 'No owner identity (code UNAUTHORIZED)' })
  updateMe(
    @CurrentOwner() ownerId: string,
    @Body() dto: UpdateOwnerProfileDto,
  ): Promise<OwnerResponseDto> {
    return this.owners.updateProfile(ownerId, dto);
  }
}
