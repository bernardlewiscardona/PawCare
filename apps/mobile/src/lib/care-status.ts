import type { StatusKey } from '@/theme/tokens';
import { daysBetween, formatRelativeDays, formatShortDate } from './format';

/** Days ahead that Care Due covers (VC-04: due today and in the next 30 days). */
export const CARE_DUE_WINDOW_DAYS = 30;

export type VaccineDueState = {
  status: Extract<StatusKey, 'overdue' | 'due' | 'due-soon' | 'upcoming'>;
  label: string;
  /** e.g. "Due Thu, 12 Nov · in 2 days" or "Was due Mon, 2 Nov · 8 days ago". */
  detail: string;
};

/**
 * Status of an owner-entered next-due date, compared as calendar dates in the owner's zone.
 * A due date before today is Overdue (VC-01/VC-04). No interval is ever inferred.
 */
export function vaccineDueState(dueDate: string, today: string): VaccineDueState {
  const diff = daysBetween(today, dueDate);
  const when = `${formatShortDate(dueDate)} · ${formatRelativeDays(dueDate, today)}`;

  if (diff < 0) return { status: 'overdue', label: 'Overdue', detail: `Was due ${when}` };
  if (diff === 0)
    return { status: 'due', label: 'Due today', detail: `Due ${formatShortDate(dueDate)}` };
  if (diff <= CARE_DUE_WINDOW_DAYS)
    return { status: 'due-soon', label: 'Due soon', detail: `Due ${when}` };
  return { status: 'upcoming', label: 'Upcoming', detail: `Due ${when}` };
}

export type DoseStatus = 'upcoming' | 'due' | 'overdue' | 'taken' | 'skipped';

/** Badge for a dose occurrence (VC-03). The status comes from the server; this only labels it. */
export function doseBadge(status: DoseStatus): { status: StatusKey; label: string } {
  switch (status) {
    case 'taken':
      return { status: 'taken', label: 'Taken' };
    case 'skipped':
      return { status: 'skipped', label: 'Skipped' };
    case 'due':
      return { status: 'due-now', label: 'Due now' };
    case 'overdue':
      return { status: 'overdue', label: 'Overdue' };
    case 'upcoming':
      return { status: 'upcoming', label: 'Upcoming' };
  }
}
