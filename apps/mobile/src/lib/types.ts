/**
 * Client-side shapes for the demo store. They mirror the ERD entities the screens need
 * (docs/design/erd-and-flows.md) and will be replaced by API DTOs story by story.
 */
import type { AvatarKey } from '@/components/ui/avatar';
import type { IllustrationName } from '@/components/ui/illustration';
import type { LedgerType, ReminderState } from '@/components/ui/rows';
import type { AttachmentState } from '@/components/ui/uploaders';

export type Species = 'Dog' | 'Cat' | 'Other';
export type Sex = 'Male' | 'Female' | 'Unknown';
export type PetTint = 'yellow' | 'blue' | 'green' | 'pink';

export type Pet = {
  id: string;
  name: string;
  species: Species;
  /** Required when species is Other (PF-02). */
  otherSpecies?: string;
  breed?: string;
  sex: Sex;
  birthDate?: string;
  /** For estimated births only the year is meaningful. */
  birthEstimated: boolean;
  weightKg?: number;
  weightMeasuredOn?: string;
  microchip?: string;
  avatar?: AvatarKey;
  tint: PetTint;
  archivedOn?: string;
  /** Reminders canceled on archive stay off after restore until turned back on (PF-04). */
  remindersOff?: boolean;
};

export type Owner = {
  displayName: string;
  email: string;
  /** National number without the +63 prefix. */
  phone?: string;
  timeZone: string;
  avatar?: AvatarKey;
};

export type NotificationPrefs = {
  push: boolean;
  visitLeadHours: 1 | 24;
  vaccineLeadDays: 7 | 1;
  /** Delivery time for date-only reminders (vaccines, supplies), HH:mm in owner zone. */
  dateOnlyTime: string;
};

export type VisitStatus = 'planned' | 'completed' | 'canceled' | 'missed';

/** Owner-entered appointment diary entry (AP-01). Times are wall-clock in `timeZone`. */
export type Visit = {
  id: string;
  petId: string;
  title: string;
  provider: string;
  contact?: string;
  location?: string;
  notes?: string;
  date: string;
  start: string;
  end: string;
  timeZone: string;
  status: VisitStatus;
  canceledOn?: string;
  cancelReason?: string;
  outcomeOn?: string;
};

export type Attachment = {
  id: string;
  name: string;
  format: 'PDF' | 'JPG' | 'PNG' | 'HEIC' | 'DOCX';
  size: string;
  state: AttachmentState;
  progress?: number;
  uploadedOn?: string;
};

/** MR-01 event types. */
export const MEDICAL_TYPES = [
  'Visit',
  'Diagnosis',
  'Procedure',
  'Allergy',
  'General note',
] as const;
export type MedicalType = (typeof MEDICAL_TYPES)[number];

export type MedicalRecord = {
  id: string;
  petId: string;
  type: MedicalType;
  title: string;
  date: string;
  provider?: string;
  notes?: string;
  linkedVisitId?: string;
  attachments: Attachment[];
  editedOn: string;
  voidedOn?: string;
  voidReason?: string;
};

export type Vaccine = {
  id: string;
  petId: string;
  name: string;
  givenOn: string;
  batch?: string;
  provider?: string;
  nextDueOn?: string;
  /** IDs of earlier vaccines whose due item this administration closes (VC-04). */
  fulfils: string[];
  attachments: Attachment[];
  voidedOn?: string;
  voidReason?: string;
};

export type ScheduleMode = 'fixed' | 'asNeeded' | 'manual';

export type Prescription = {
  id: string;
  petId: string;
  medication: string;
  instructions: string;
  /** Short per-dose text shown on dose rows, e.g. "1 tablet with food". */
  doseLabel?: string;
  prescriber?: string;
  startDate: string;
  endDate?: string;
  mode: ScheduleMode;
  /** Fixed daily local times, HH:mm. */
  times: string[];
  timeZone: string;
  supplyId?: string;
  stoppedOn?: string;
};

export type DoseLog = {
  id: string;
  prescriptionId: string;
  date: string;
  time: string;
  status: 'taken' | 'skipped';
  /** When it was logged, HH:mm. */
  at?: string;
  note?: string;
};

export const SUPPLY_CATEGORIES = ['Food', 'Medication', 'Supplement', 'Grooming', 'Other'] as const;
export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

export const SUPPLY_UNITS = ['piece', 'tablet', 'capsule', 'sachet', 'g', 'kg', 'ml'] as const;
export type SupplyUnit = (typeof SUPPLY_UNITS)[number];

export type Batch = { id: string; label: string; expiresOn?: string; quantity: number };

export type LedgerEntry = {
  id: string;
  type: LedgerType;
  date: string;
  time?: string;
  detail: string;
  /** Signed quantity in the item's unit. */
  quantity: number;
  batchId?: string;
  reversedById?: string;
};

export type Supply = {
  id: string;
  name: string;
  category: SupplyCategory;
  unit: SupplyUnit;
  illustration: IllustrationName;
  petIds: string[];
  alertAt?: number;
  expiryLeadDays: 7 | 30;
  batches: Batch[];
  ledger: LedgerEntry[];
  archivedOn?: string;
};

export type InboxItem = {
  id: string;
  source: 'dose' | 'vaccine' | 'visit' | 'supply' | 'custom';
  sourceId: string;
  petId?: string;
  title: string;
  detail: string;
  time: string;
  section: 'today' | 'earlier';
  state: ReminderState;
  illustration: IllustrationName;
  /** Dose reminders point at one scheduled occurrence. */
  occurrence?: { date: string; time: string };
};

export type CustomReminder = {
  id: string;
  petId: string;
  title: string;
  startDate: string;
  time: string;
  repeat: 'once' | 'daily';
  endDate?: string;
  enabled: boolean;
};
