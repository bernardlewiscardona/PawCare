import { ApiProperty } from '@nestjs/swagger';
import type { Pet } from '../../generated/prisma/client.js';
import { SEXES, SPECIES } from '@pawcare/core';

const dateOnly = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

/** A pet profile. Optional fields are present as null. Weight is always kilograms. */
export class PetResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Mochi' }) name!: string;
  @ApiProperty({ enum: SPECIES }) species!: string;
  @ApiProperty({ type: String, nullable: true }) speciesOther!: string | null;
  @ApiProperty({ type: String, nullable: true }) breed!: string | null;
  @ApiProperty({ enum: SEXES }) sex!: string;
  @ApiProperty({ type: String, nullable: true, example: '2021-03-14' }) birthDate!: string | null;
  @ApiProperty() birthDateEstimated!: boolean;
  @ApiProperty({ type: Number, nullable: true, example: 4.2 }) currentWeightKg!: number | null;
  @ApiProperty({ type: String, nullable: true }) weightMeasuredOn!: string | null;
  @ApiProperty({ type: String, nullable: true }) microchip!: string | null;
  @ApiProperty({ example: 1 }) version!: number;
  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' }) createdAt!: string;

  static from(pet: Pet): PetResponseDto {
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      speciesOther: pet.speciesOther,
      breed: pet.breed,
      sex: pet.sex,
      birthDate: dateOnly(pet.birthDate),
      birthDateEstimated: pet.birthDateEstimated,
      currentWeightKg: pet.currentWeightKg === null ? null : Number(pet.currentWeightKg),
      weightMeasuredOn: dateOnly(pet.weightMeasuredOn),
      microchip: pet.microchip,
      version: pet.version,
      createdAt: pet.createdAt.toISOString(),
    };
  }
}
