// The public contract of the phone data layer. Screens import from here, never from deeper files.
export { DataError } from './errors';
export type {
  OwnerProfile,
  UpdateOwnerInput,
  Pet,
  CreatePetInput,
  UpdatePetInput,
  PetPage,
  MedicalEvent,
  MedicalEventType,
  CreateMedicalEventInput,
  MedicalEventPage,
} from './types';
export type { OpenResult, PawCareData } from './open';
export type { TableName } from './database';
export { DataProvider, useData, useDataState } from './provider';
export type { DataState } from './provider';
export { useLiveQuery } from './live-query';
