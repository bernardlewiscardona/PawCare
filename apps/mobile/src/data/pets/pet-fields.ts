import {
  checkPastOrToday,
  normalizeMicrochip,
  normalizeOptionalText,
  normalizePetName,
  toGrams,
  type RuleError,
} from '@pawcare/core';
import type { Pet } from '../types';

/** A `pets` row as SQLite returns it. */
export interface PetRow {
  id: string;
  name: string;
  species: Pet['species'];
  species_other: string | null;
  breed: string | null;
  sex: Pet['sex'];
  birth_date: string | null;
  birth_date_estimated: number;
  current_weight_g: number | null;
  weight_measured_on: string | null;
  microchip: string | null;
  version: number;
  created_at: string;
  archived_at: string | null;
}

export function toPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    speciesOther: row.species_other,
    breed: row.breed,
    sex: row.sex,
    birthDate: row.birth_date,
    birthDateEstimated: row.birth_date_estimated === 1,
    currentWeightKg: row.current_weight_g === null ? null : row.current_weight_g / 1000,
    weightMeasuredOn: row.weight_measured_on,
    microchip: row.microchip,
    version: row.version,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

// Field rules shared by create and update. The rules live in @pawcare/core; these fix the copy.
export const DESCRIBE_SPECIES = 'Describe the species in 1–100 characters.';
export const ONLY_OTHER = 'Only add a description when the species is Other.';
export const ESTIMATE_NEEDS_DATE = 'Add a birth date to mark it as estimated.';
export const DATE_NEEDS_WEIGHT = 'Add a weight for this measurement date.';
export const WEIGHT_NEEDS_DATE = 'A weight needs a measurement date.';

export const petRules = {
  name: (v: string) => normalizePetName(v),
  speciesOther: (v: string) => normalizeOptionalText(v, 100, DESCRIBE_SPECIES),
  breed: (v: string) => normalizeOptionalText(v, 100, 'Enter a breed of 1–100 characters.'),
  birthDate: (v: string, today: string) =>
    checkPastOrToday(v, today, "The birth date can't be in the future."),
  weightGrams: (w: { value: number; unit: 'KG' | 'LB' }) => toGrams(w.value, w.unit),
  weightMeasuredOn: (v: string, today: string) =>
    checkPastOrToday(v, today, "The measurement date can't be in the future."),
  microchip: (v: string) => normalizeMicrochip(v),
} satisfies Record<string, (...args: never[]) => unknown | RuleError>;
