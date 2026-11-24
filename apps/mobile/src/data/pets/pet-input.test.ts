import { MAX_INT4 } from '@pawcare/core';
import { describe, expect, it } from 'vitest';
import { DataError } from '../errors';
import {
  CHOOSE_SEX,
  CHOOSE_SPECIES,
  CHOOSE_UNIT,
  INVALID,
  NOT_ALLOWED,
  VERSION,
  WEIGHT_NUMBER,
} from '../shape';
import { parseUpdatePetInput } from './pet-input';

const ID = '01900000-0000-7000-8000-000000000002';

function fieldErrors(input: unknown): Record<string, string[]> {
  try {
    parseUpdatePetInput(input);
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    expect((e as DataError).code).toBe('VALIDATION_FAILED');
    return ((e as DataError).details as { fields: Record<string, string[]> }).fields;
  }
  throw new Error('expected rejection');
}

describe('parseUpdatePetInput', () => {
  it('accepts an id and version alone', () => {
    expect(parseUpdatePetInput({ id: ID, version: 1 })).toEqual({ id: ID, version: 1 });
  });

  it('accepts null for every clearable field', () => {
    const input = {
      id: ID,
      version: 3,
      speciesOther: null,
      breed: null,
      birthDate: null,
      weight: null,
      weightMeasuredOn: null,
      microchip: null,
    };
    expect(parseUpdatePetInput(input)).toEqual(input);
  });

  it('refuses null for fields that cannot be cleared', () => {
    expect(
      fieldErrors({
        id: ID,
        version: 1,
        name: null,
        species: null,
        sex: null,
        birthDateEstimated: null,
      }),
    ).toEqual({
      name: [INVALID],
      species: [CHOOSE_SPECIES],
      sex: [CHOOSE_SEX],
      birthDateEstimated: [INVALID],
    });
  });

  it('checks types', () => {
    expect(
      fieldErrors({ id: ID, version: 1, name: 5, breed: 7, species: 'FISH', sex: 'X' }),
    ).toEqual({ name: [INVALID], breed: [INVALID], species: [CHOOSE_SPECIES], sex: [CHOOSE_SEX] });
  });

  it('needs a valid version', () => {
    for (const version of [0, 1.5, '1', MAX_INT4 + 1, undefined]) {
      expect(fieldErrors({ id: ID, version }).version).toEqual([VERSION]);
    }
  });

  it('needs a string id', () => {
    expect(fieldErrors({ version: 1 }).id).toEqual([INVALID]);
    expect(fieldErrors({ id: 5, version: 1 }).id).toEqual([INVALID]);
  });

  it('leaves a non-UUID string id to the repository', () => {
    expect(parseUpdatePetInput({ id: 'nope', version: 1 })).toEqual({ id: 'nope', version: 1 });
  });

  it('rejects unknown keys and a bad weight, all in one error', () => {
    expect(
      fieldErrors({ id: ID, version: 1, ownerId: 'x', weight: { value: 'x', unit: 'ST' } }),
    ).toEqual({ ownerId: [NOT_ALLOWED], weight: [WEIGHT_NUMBER, CHOOSE_UNIT] });
  });
});
