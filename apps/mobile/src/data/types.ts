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

export interface PetPage {
  data: Pet[];
  nextCursor: string | null;
}
