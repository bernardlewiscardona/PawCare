/**
 * MR-03 health timeline, derived from canonical records: medical events, administered vaccines,
 * prescription starts and Completed visits. Each source appears once and links to its detail.
 */
import type { RecordMeta } from '@/components/care-cards';
import type { RecordKind } from '@/theme/tokens';
import { formatDate, formatDateRange, formatDayMonthShort } from './format';
import type { DemoState } from './seed';

export type TimelineEntry = {
  id: string;
  kind: RecordKind;
  date: string;
  context: string;
  title: string;
  body?: string;
  meta: RecordMeta[];
  voided: boolean;
  href: string;
};

export const MODE_LABEL = {
  fixed: 'Fixed daily',
  asNeeded: 'As needed',
  manual: 'Manual',
} as const;

export function buildTimeline(state: DemoState, petId: string | undefined): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const r of state.medical.filter((m) => m.petId === petId)) {
    const files = r.attachments.filter((a) => a.state === 'attached').length;
    entries.push({
      id: r.id,
      kind: 'medical',
      date: r.date,
      context: `Medical · ${r.type}`,
      title: r.title,
      body: r.voidedOn ? `Voided: ${r.voidReason}` : r.notes,
      meta: r.voidedOn
        ? [{ label: 'Entered by you' }]
        : [
            ...(r.provider ? [{ icon: 'stethoscope' as const, label: r.provider }] : []),
            ...(files
              ? [
                  {
                    icon: 'paperclip' as const,
                    label: `${files} ${files === 1 ? 'file' : 'files'}`,
                  },
                ]
              : []),
          ],
      voided: Boolean(r.voidedOn),
      href: `/records/${r.id}`,
    });
  }

  for (const v of state.vaccines.filter((x) => x.petId === petId)) {
    entries.push({
      id: v.id,
      kind: 'vaccine',
      date: v.givenOn,
      context: 'Vaccine',
      title: v.name,
      body: v.voidedOn
        ? `Voided: ${v.voidReason}`
        : v.nextDueOn
          ? `Next dose due ${formatDate(v.nextDueOn)}`
          : 'No next date recorded',
      meta:
        v.provider && !v.voidedOn
          ? [{ icon: 'stethoscope', label: v.provider }]
          : v.voidedOn
            ? [{ label: 'Entered by you' }]
            : [],
      voided: Boolean(v.voidedOn),
      href: `/vaccines/${v.id}`,
    });
  }

  for (const rx of state.prescriptions.filter((x) => x.petId === petId)) {
    entries.push({
      id: rx.id,
      kind: 'prescription',
      date: rx.startDate,
      context: `Medication · ${MODE_LABEL[rx.mode]}`,
      title: rx.medication,
      body: rx.instructions,
      meta: [
        {
          icon: 'calendar',
          label: rx.endDate
            ? formatDateRange(rx.startDate, rx.stoppedOn ?? rx.endDate)
            : `From ${formatDayMonthShort(rx.startDate)}`,
        },
      ],
      voided: false,
      href: `/prescriptions/${rx.id}`,
    });
  }

  for (const visit of state.visits.filter((x) => x.petId === petId && x.status === 'completed')) {
    entries.push({
      id: visit.id,
      kind: 'visit',
      date: visit.date,
      context: 'Visit · Completed',
      title: visit.title,
      body: visit.notes,
      meta: [{ icon: 'map-pin', label: visit.provider }],
      voided: false,
      href: `/visits/${visit.id}`,
    });
  }

  // Newest first; the ID breaks same-day ties so pagination stays stable.
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
