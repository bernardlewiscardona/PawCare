/**
 * Derived, never stored (CLAUDE.md data-model rules): visit "Needs update", prescription
 * lifecycle, dose occurrence status, Care Due, supply balances and alerts, and the timeline.
 */
import type { StatusKey } from '@/theme/tokens';
import type { DoseStatus } from './care-status';
import { daysBetween } from './format';
import type { Batch, DoseLog, Pet, Prescription, Supply, Vaccine, Visit } from './types';

export type Now = { date: string; time: string };

const at = (date: string, time: string) => `${date}T${time}`;

/** Planned visits whose start has passed are "Needs update"; never auto-completed (AP-02). */
export function visitDisplayStatus(
  visit: Visit,
  now: Now,
): Extract<StatusKey, 'planned' | 'needs-update' | 'completed' | 'canceled' | 'missed'> {
  if (visit.status !== 'planned') return visit.status;
  return at(visit.date, visit.start) <= at(now.date, now.time) ? 'needs-update' : 'planned';
}

export function isUpcomingVisit(visit: Visit, now: Now): boolean {
  return visitDisplayStatus(visit, now) === 'planned';
}

/** Soonest first, ID breaks ties (stable sort). */
export function byStart(a: Visit, b: Visit): number {
  return at(a.date, a.start).localeCompare(at(b.date, b.start)) || a.id.localeCompare(b.id);
}

export type RxState = Extract<StatusKey, 'active' | 'ended' | 'stopped' | 'upcoming'>;

/** VC-03: derive Active/Ended from dates unless explicitly stopped. */
export function prescriptionState(rx: Prescription, today: string): RxState {
  if (rx.stoppedOn) return 'stopped';
  if (rx.endDate && rx.endDate < today) return 'ended';
  if (rx.startDate > today) return 'upcoming';
  return 'active';
}

export type DoseOccurrence = {
  prescriptionId: string;
  date: string;
  time: string;
  status: DoseStatus;
  log?: DoseLog;
};

/** Minutes a dose stays "Due now" after its time before it becomes Overdue. */
export const DUE_NOW_MINUTES = 60;

function minutes(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Status of one scheduled dose. A dose is Overdue only after its scheduled instant and only
 * while neither Taken nor Skipped (VC-04); a reminder never logs it (shared requirement 8).
 */
export function doseStatus(
  date: string,
  time: string,
  log: DoseLog | undefined,
  now: Now,
): DoseStatus {
  if (log) return log.status;
  if (date > now.date) return 'upcoming';
  if (date < now.date) return 'overdue';
  const late = minutes(now.time) - minutes(time);
  if (late < 0) return 'upcoming';
  return late <= DUE_NOW_MINUTES ? 'due' : 'overdue';
}

/** Fixed-daily dose occurrences of a prescription on one date. */
export function dosesOn(
  rx: Prescription,
  logs: DoseLog[],
  date: string,
  now: Now,
): DoseOccurrence[] {
  if (rx.mode !== 'fixed' || rx.startDate > date || (rx.endDate && rx.endDate < date)) return [];
  if (rx.stoppedOn && rx.stoppedOn <= date) return [];
  return [...rx.times].sort().map((time) => {
    const log = logs.find((l) => l.prescriptionId === rx.id && l.date === date && l.time === time);
    return { prescriptionId: rx.id, date, time, status: doseStatus(date, time, log, now), log };
  });
}

/** Total scheduled doses over the course, for "11 of 22" summaries. */
export function scheduledDoseCount(rx: Prescription): number | undefined {
  if (rx.mode !== 'fixed' || !rx.endDate) return undefined;
  return (daysBetween(rx.startDate, rx.endDate) + 1) * rx.times.length;
}

/** Open due items: vaccines with a next due date not closed by a later administration. */
export function openVaccineDues(vaccines: Vaccine[], petId: string | undefined): Vaccine[] {
  const live = vaccines.filter((v) => !v.voidedOn);
  const fulfilled = new Set(live.flatMap((v) => v.fulfils));
  return live
    .filter((v) => v.petId === petId && v.nextDueOn && !fulfilled.has(v.id))
    .sort(
      (a, b) => (a.nextDueOn ?? '').localeCompare(b.nextDueOn ?? '') || a.id.localeCompare(b.id),
    );
}

export type BatchState = Extract<StatusKey, 'usable' | 'expiring' | 'expired' | 'unknown-expiry'>;

/**
 * A batch expires at the start of the day after its expiry date (IN-02). Unknown expiry counts
 * as usable without implying it is safe.
 */
export function batchState(batch: Batch, leadDays: number, today: string): BatchState {
  if (!batch.expiresOn) return 'unknown-expiry';
  if (batch.expiresOn < today) return 'expired';
  return daysBetween(today, batch.expiresOn) <= leadDays ? 'expiring' : 'usable';
}

export type SupplyStats = {
  physical: number;
  usable: number;
  alert?: Extract<StatusKey, 'low-stock' | 'expiring' | 'expired'>;
  expiredBatches: Batch[];
};

/** Physical = all remaining batches; usable excludes expired ones (IN-02, IN-04). */
export function supplyStats(supply: Supply, today: string): SupplyStats {
  const live = supply.batches.filter((b) => b.quantity > 0);
  const states = live.map((b) => ({ b, s: batchState(b, supply.expiryLeadDays, today) }));
  const physical = round(live.reduce((n, b) => n + b.quantity, 0));
  const usable = round(
    states.filter((x) => x.s !== 'expired').reduce((n, x) => n + x.b.quantity, 0),
  );
  const expiredBatches = states.filter((x) => x.s === 'expired').map((x) => x.b);
  let alert: SupplyStats['alert'];
  if (supply.alertAt !== undefined && usable <= supply.alertAt) alert = 'low-stock';
  else if (expiredBatches.length) alert = 'expired';
  else if (states.some((x) => x.s === 'expiring')) alert = 'expiring';
  return { physical, usable, alert, expiredBatches };
}

/** Avoid binary float drift on decimal quantities (max three places, IN-01). */
export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Earliest-expiring usable batch first; unknown expiry after dated batches (IN-03). */
export function consumptionOrder(batches: Batch[], today: string): Batch[] {
  return batches
    .filter((b) => b.quantity > 0 && !(b.expiresOn && b.expiresOn < today))
    .sort(
      (a, b) =>
        (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') || a.id.localeCompare(b.id),
    );
}

export function speciesLabel(pet: Pet): string {
  return pet.species === 'Other' ? (pet.otherSpecies ?? 'Other') : pet.species;
}

/** "Dog · Shih Tzu" */
export function petKind(pet: Pet): string {
  return [speciesLabel(pet), pet.breed].filter(Boolean).join(' · ');
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}
