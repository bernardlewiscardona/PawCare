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
