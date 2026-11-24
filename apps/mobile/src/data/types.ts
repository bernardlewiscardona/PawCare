export interface OwnerProfile {
  id: string;
  displayName: string | null;
  phone: string | null;
  timeZone: string;
  weightUnit: 'KG' | 'LB';
  profileSetupRequired: boolean;
  version: number;
}

export interface UpdateOwnerInput {
  version: number;
  displayName?: string;
  timeZone?: string;
  phone?: string | null;
  weightUnit?: 'KG' | 'LB';
}

export interface Pet {
  id: string;
  name: string;
  species: 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'OTHER';
  speciesOther: string | null;
  breed: string | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  birthDate: string | null;
  birthDateEstimated: boolean;
  currentWeightKg: number | null;
  weightMeasuredOn: string | null;
  microchip: string | null;
  version: number;
  createdAt: string;
  /** Set once the pet is archived (PF-04); archived pets are read-only and leave the selector. */
  archivedAt: string | null;
}

export interface CreatePetInput {
  name: string;
  species: Pet['species'];
  speciesOther?: string;
  breed?: string;
  sex?: Pet['sex'];
  birthDate?: string;
  birthDateEstimated?: boolean;
  weight?: { value: number; unit: 'KG' | 'LB' };
  weightMeasuredOn?: string;
  microchip?: string;
}

/** `null` clears an optional field; `name`, `species`, `sex` and `birthDateEstimated` can't be null. */
export interface UpdatePetInput {
  id: string;
  version: number;
  name?: string;
  species?: Pet['species'];
  speciesOther?: string | null;
  breed?: string | null;
  sex?: Pet['sex'];
  birthDate?: string | null;
  birthDateEstimated?: boolean;
  weight?: { value: number; unit: 'KG' | 'LB' } | null;
  weightMeasuredOn?: string | null;
  microchip?: string | null;
}

export interface PetPage {
  data: Pet[];
  nextCursor: string | null;
}
