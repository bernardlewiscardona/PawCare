import { localDate } from '@pawcare/core';
import type { DataDeps } from '../deps';
import { UUID } from '../paging';
import type { SqlConnection } from '../sql';

/** Steps every care-record kind shares (MR-01 medical events, VC-01 vaccines, …). */

export interface ActivePet {
  id: string;
  name: string;
  birth_date: string | null;
}

/** The owner's active pet, or `undefined` for archived, malformed, unknown or another owner's. */
export async function readActivePet(
  c: SqlConnection,
  ownerId: string,
  petId: string,
): Promise<ActivePet | undefined> {
  if (!UUID.test(petId)) return undefined;
  return c.get<ActivePet>(
    'SELECT id, name, birth_date FROM pets WHERE owner_id = ? AND id = ? AND archived_at IS NULL',
    [ownerId, petId],
  );
}

/** The owner's pet ID, archived included (history stays readable), or `undefined`. */
export async function readOwnedPetId(
  c: SqlConnection,
  ownerId: string,
  petId: string,
): Promise<string | undefined> {
  if (!UUID.test(petId)) return undefined;
  const row = await c.get<{ id: string }>('SELECT id FROM pets WHERE owner_id = ? AND id = ?', [
    ownerId,
    petId,
  ]);
  return row?.id;
}

/** Today's date in the owner's time zone, for "not in the future" and Overdue. */
export async function ownerToday(
  c: SqlConnection,
  ownerId: string,
  deps: DataDeps,
): Promise<string> {
  const owner = await c.get<{ time_zone: string }>('SELECT time_zone FROM owners WHERE id = ?', [
    ownerId,
  ]);
  return localDate(owner!.time_zone, deps.now());
}

/** Inserts the `care_records` parent; the caller writes the subtype row in the same write. */
export async function insertCareRecord(
  c: SqlConnection,
  row: {
    id: string;
    ownerId: string;
    petId: string;
    kind: 'MEDICAL' | 'VACCINE';
    occurrenceDate: string;
    at: string;
  },
): Promise<void> {
  await c.run(
    `INSERT INTO care_records (id, owner_id, pet_id, kind, occurrence_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.ownerId, row.petId, row.kind, row.occurrenceDate, row.at, row.at],
  );
}

/** The "save anyway?" text for a date before the pet's birth date, or `null`. */
export function beforeBirthWarning(pet: ActivePet, date: string): string | null {
  return pet.birth_date !== null && date < pet.birth_date
    ? `This date is before ${pet.name}'s birth date. Save anyway?`
    : null;
}
