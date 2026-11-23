import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnerResponseDto } from './dto/owner-response.dto.js';

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(ownerId: string): Promise<OwnerResponseDto> {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, 'Not found');
    return OwnerResponseDto.from(owner);
  }
}
