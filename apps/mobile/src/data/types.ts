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

export type MedicalEventType = 'VISIT' | 'DIAGNOSIS' | 'PROCEDURE' | 'ALLERGY' | 'GENERAL_NOTE';

/** An owner-entered medical event (MR-01): a care record of kind MEDICAL plus its details. */
export interface MedicalEvent {
  id: string;
  petId: string;
  eventType: MedicalEventType;
  title: string;
  /** Date only, `YYYY-MM-DD`; no time is invented. */
  occurrenceDate: string;
  notes: string | null;
  providerName: string | null;
  status: 'ACTIVE' | 'VOIDED';
  /** Always shown as "Owner-entered", never as verified. */
  provenance: 'OWNER_ENTERED';
  voidReason: string | null;
  voidedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicalEventInput {
  petId: string;
  eventType: MedicalEventType;
  title: string;
  occurrenceDate: string;
  notes?: string;
  providerName?: string;
  /** Set after the owner confirms a date before the pet's birth date. */
  confirmBeforeBirth?: boolean;
}

export interface MedicalEventPage {
  data: MedicalEvent[];
  nextCursor: string | null;
}
