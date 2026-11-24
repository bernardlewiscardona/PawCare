import { isRuleError, type FieldErrors, type RuleError } from '@pawcare/core';
import { validationFailed } from '../errors';
import type { SqlValue } from '../sql';
import type { UpdatePetInput } from '../types';
import {
  DATE_NEEDS_WEIGHT,
  DESCRIBE_SPECIES,
  ESTIMATE_NEEDS_DATE,
  ONLY_OTHER,
  WEIGHT_NEEDS_DATE,
  petRules,
  type PetRow,
} from './pet-fields';

/** Field name (as the change log and the contract name it) → `pets` column. */
const COLUMNS = {
  name: 'name',
  species: 'species',
  speciesOther: 'species_other',
  breed: 'breed',
  sex: 'sex',
  birthDate: 'birth_date',
  birthDateEstimated: 'birth_date_estimated',
  currentWeightKg: 'current_weight_g',
  weightMeasuredOn: 'weight_measured_on',
  microchip: 'microchip',
} as const;

type Field = keyof typeof COLUMNS;

export interface PetChanges {
  /** Changed field names, for the change log. */
  fields: Field[];
  /** `[column, value]` pairs for the UPDATE; columns come from `COLUMNS`, never from input. */
  sets: [column: string, value: SqlValue][];
}

/**
 * Merges an update into the current row: a field not sent keeps its value, `null` clears it.
 * Paired fields are checked on the merged result (Other ↔ description, birth date ↔ estimated,
 * weight ↔ measurement date). Throws one VALIDATION_FAILED listing every error.
 */
export function mergePetUpdate(row: PetRow, input: UpdatePetInput, today: string): PetChanges {
  const errors: FieldErrors = {};
  const check = <T>(field: string, result: T | RuleError, fallback: T): T => {
    if (!isRuleError(result)) return result as T;
    errors[field] = [result.error];
    return fallback;
  };
  /** Not sent → current value; `null` → cleared; a value → run its rule. */
  const optional = <T>(
    field: string,
    sent: string | null | undefined,
    current: T | null,
    rule: (v: string) => T | RuleError,
  ): T | null => {
    if (sent === undefined) return current;
    if (sent === null) return null;
    return check(field, rule(sent), current);
  };

  const name =
    input.name === undefined ? row.name : check('name', petRules.name(input.name), row.name);
  const species = input.species ?? row.species;

  let speciesOther: string | null = null;
  if (species === 'OTHER') {
    if (typeof input.speciesOther === 'string') {
      speciesOther = check('speciesOther', petRules.speciesOther(input.speciesOther), null);
    } else if (input.speciesOther === null || row.species_other === null) {
      errors.speciesOther = [DESCRIBE_SPECIES];
    } else {
      speciesOther = row.species_other;
    }
  } else if (typeof input.speciesOther === 'string') {
    errors.speciesOther = [ONLY_OTHER];
  }

  const breed = optional('breed', input.breed, row.breed, petRules.breed);
  const sex = input.sex ?? row.sex;
  const birthDate = optional('birthDate', input.birthDate, row.birth_date, (v) =>
    petRules.birthDate(v, today),
  );

  let birthDateEstimated = input.birthDateEstimated ?? row.birth_date_estimated === 1;
  if (birthDate === null) {
    if (input.birthDateEstimated === true) errors.birthDateEstimated = [ESTIMATE_NEEDS_DATE];
    birthDateEstimated = false;
  }

  let grams = row.current_weight_g;
  if (input.weight === null) grams = null;
  else if (input.weight !== undefined) {
    grams = check('weight', petRules.weightGrams(input.weight), row.current_weight_g);
  }
  const hasWeight =
    input.weight === undefined ? row.current_weight_g !== null : input.weight !== null;

  let measuredOn: string | null = null;
  if (!hasWeight) {
    if (typeof input.weightMeasuredOn === 'string') errors.weightMeasuredOn = [DATE_NEEDS_WEIGHT];
  } else if (typeof input.weightMeasuredOn === 'string') {
    measuredOn = check(
      'weightMeasuredOn',
      petRules.weightMeasuredOn(input.weightMeasuredOn, today),
      row.weight_measured_on,
    );
  } else if (input.weightMeasuredOn === null) {
    errors.weightMeasuredOn = [WEIGHT_NEEDS_DATE];
  } else {
    measuredOn = input.weight ? today : row.weight_measured_on;
  }

  const microchip = optional('microchip', input.microchip, row.microchip, petRules.microchip);
  if (Object.keys(errors).length > 0) throw validationFailed(errors);

  const next: Record<Field, SqlValue> = {
    name,
    species,
    speciesOther,
    breed,
    sex,
    birthDate,
    birthDateEstimated: birthDateEstimated ? 1 : 0,
    currentWeightKg: grams,
    weightMeasuredOn: measuredOn,
    microchip,
  };
  const fields = (Object.keys(COLUMNS) as Field[]).filter(
    (f) => next[f] !== (row[COLUMNS[f]] as SqlValue),
  );
  return { fields, sets: fields.map((f) => [COLUMNS[f], next[f]]) };
}
