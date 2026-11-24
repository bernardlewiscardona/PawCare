export const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'] as const;
export const SEXES = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
export const WEIGHT_UNITS = ['KG', 'LB'] as const;
/** Medical event types (MR-01). */
export const MEDICAL_EVENT_TYPES = [
  'VISIT',
  'DIAGNOSIS',
  'PROCEDURE',
  'ALLERGY',
  'GENERAL_NOTE',
] as const;

/** Page size rules for collections: default 20, at most 100. */
export const PAGE_LIMIT = { min: 1, max: 100, default: 20 } as const;

/** Largest value of a 32-bit signed integer column, such as owners.version. */
export const MAX_INT4 = 2_147_483_647;
