// The public contract of the phone data layer. Screens import from here, never from deeper files.
export { DataError } from './errors';
export type { OwnerProfile, UpdateOwnerInput, Pet, CreatePetInput, PetPage } from './types';
export type { OpenResult, PawCareData } from './open';
export type { TableName } from './database';
