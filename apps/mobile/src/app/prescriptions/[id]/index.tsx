import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DoseRow, RecordHero } from '@/components/care-cards';
import { NotFound } from '@/components/not-found';
import { DoseSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { KindTag, StatusBadge, TypeTag } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { FieldGroup, Textarea } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { DetailCard, ListItem } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { dosesOn, prescriptionState, scheduledDoseCount, type DoseOccurrence } from '@/lib/derive';
import {
  daysBetween,
  formatDate,
  formatDateRangeYear,
  formatDayMonthShort,
  formatTime12h,
} from '@/lib/format';
import { useStore } from '@/lib/store';
import { MODE_LABEL } from '@/lib/timeline';
import type { DoseLog } from '@/lib/types';
import { color as palette } from '@/theme/tokens';

function dayLabel(date: string, today: string) {
  const d = daysBetween(date, today);
  return d === 0
    ? 'Today'
    : d === 1
      ? 'Yesterday'
      : d === -1
        ? 'Tomorrow'
        : formatDayMonthShort(date);
}

/**
 * Figma: 40 Vaccines & Meds / Prescription detail (Active, As needed, Stopped), Stop
 * prescription and Dose log correction. VC-02 / VC-03.
 */
export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, today, now, actions } = useStore();
  const toast = useToast();
  const [sheet, setSheet] = useState<'menu' | 'stop' | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const [dose, setDose] = useState<DoseOccurrence | null>(null);
  const [correcting, setCorrecting] = useState<DoseLog | null>(null);
  const [result, setResult] = useState<'taken' | 'skipped'>('taken');
  const [note, setNote] = useState('');
  const rx = state.prescriptions.find((r) => r.id === id);
  if (!rx) return <NotFound title="Prescription" />;

  const pet = state.pets.find((p) => p.id === rx.petId);
  const supply = state.supplies.find((s) => s.id === rx.supplyId);
  const rxState = prescriptionState(rx, today);
  const live = rxState === 'active' || rxState === 'upcoming';
  const logs = state.doseLogs
    .filter((l) => l.prescriptionId === rx.id)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const total = scheduledDoseCount(rx);
  const tomorrow = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8)) + 1),
  )
    .toISOString()
    .slice(0, 10);
  const nextDoses = live
    ? [...dosesOn(rx, state.doseLogs, today, now), ...dosesOn(rx, state.doseLogs, tomorrow, now)]
        .filter((o) => o.status !== 'taken' && o.status !== 'skipped')
        .slice(0, 2)
    : [];
  const history = allHistory ? logs : logs.slice(0, 2);
  const label = rx.doseLabel ?? rx.instructions;

  const openCorrection = (log: DoseLog) => {
    setCorrecting(log);
    setResult(log.status);
    setNote(log.note ?? '');
  };

  return (
    <StackScreen
      header={
        <DetailHeader
          title="Prescription"
          action={
            live
              ? { icon: 'more-horizontal', label: 'More actions', onPress: () => setSheet('menu') }
              : undefined
          }
        />
      }
      bottomBar={
        live ? (
          <Button
            label="Stop prescription"
            variant="secondary"
            block
            onPress={() => setSheet('stop')}
          />
        ) : undefined
      }
    >
      {rxState === 'stopped' ? (
        <Banner
          tone="neutral"
          title={`Stopped on ${formatDate(rx.stoppedOn as string)}`}
          body="Upcoming doses and reminders were canceled. Past doses stay in history."
        />
      ) : rxState === 'ended' ? (
        <Banner
          tone="neutral"
          title={`Ended on ${formatDate(rx.endDate as string)}`}
          body="The course finished. Past doses stay in history."
        />
      ) : null}
      <RecordHero
        tint={palette.kind.prescription}
        muted={!live}
        tags={
          <>
            {live ? <KindTag kind="prescription" /> : null}
            <TypeTag label={MODE_LABEL[rx.mode]} />
            <StatusBadge status={rxState} />
          </>
        }
        title={rx.medication}
        body={rx.instructions}
        meta={[
          {
            icon: 'calendar',
            label: rx.endDate
              ? formatDateRangeYear(rx.startDate, rx.stoppedOn ?? rx.endDate)
              : `From ${formatDate(rx.startDate)}`,
          },
          ...(rx.prescriber ? [{ icon: 'stethoscope' as const, label: rx.prescriber }] : []),
        ]}
      />
      <DetailCard
        rows={[
          ['Pet', pet?.name ?? '—'],
          [
            'Dose times',
            rx.times.length ? rx.times.map(formatTime12h).join(' · ') : 'None scheduled',
          ],
          ['Time zone', rx.timeZone],
          ['Linked supply', supply?.name ?? 'Not linked'],
        ]}
      />
      {rx.mode === 'asNeeded' ? (
        <Banner
          tone="info"
          title="No dose reminders"
          body="As-needed prescriptions don’t schedule doses. Record stock use in Supplies when you give one."
        />
      ) : rx.mode === 'manual' ? (
        <Banner
          tone="info"
          title="Manual schedule"
          body="This schedule isn’t turned into daily doses. Use custom reminders if you need alerts."
        />
      ) : null}
      {nextDoses.length ? (
        <>
          <SectionHeader title="Next doses" />
          {nextDoses.map((o) => (
            <DoseRow
              key={`${o.date}-${o.time}`}
              medication={rx.medication}
              time={o.time}
              detail={`${dayLabel(o.date, today)} · ${label}`}
              status={o.status}
              onPress={o.date === today ? () => setDose(o) : undefined}
            />
          ))}
        </>
      ) : null}
      {rx.mode === 'fixed' ? (
        logs.length ? (
          <>
            <SectionHeader
              title="Dose history"
              actionLabel={logs.length > 2 ? (allHistory ? 'Show less' : 'See all') : undefined}
              onActionPress={() => setAllHistory((v) => !v)}
            />
            {history.map((log) => (
              <DoseRow
                key={log.id}
                medication={rx.medication}
                time={log.time}
                detail={
                  log.status === 'taken'
                    ? `${dayLabel(log.date, today)} · taken at ${formatTime12h(log.at ?? log.time)}`
                    : `${dayLabel(log.date, today)} · ${log.note ?? 'skipped'}`
                }
                status={log.status}
                onPress={() => openCorrection(log)}
              />
            ))}
          </>
        ) : (
          <AppText variant="caption" color={palette.text.secondary}>
            No doses logged yet. Reminders are set for each dose time.
          </AppText>
        )
      ) : null}

      <BottomSheet visible={sheet === 'menu'} title={rx.medication} onClose={() => setSheet(null)}>
        <ListItem
          title="Edit prescription"
          icon="pencil"
          onPress={() => {
            setSheet(null);
            router.push(`/prescriptions/${rx.id}/edit`);
          }}
        />
        <ListItem
          title="Stop prescription"
          subtitle="Cancels upcoming doses"
          icon="x"
          onPress={() => setSheet('stop')}
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'stop'}
        title={`Stop ${rx.medication}?`}
        onClose={() => setSheet(null)}
      >
        <AppText variant="bodyM" color={palette.text.secondary}>
          Stops now. Upcoming doses and their reminders are canceled; doses you logged stay in
          history.
        </AppText>
        <DetailCard
          rows={[
            ['Doses logged', total ? `${logs.length} of ${total}` : String(logs.length)],
            [
              'Next dose',
              nextDoses[0]
                ? `${dayLabel(nextDoses[0].date, today)}, ${formatTime12h(nextDoses[0].time)}`
                : 'None',
            ],
          ]}
        />
        <Button
          label="Stop prescription"
          variant="destructive"
          block
          onPress={() => {
            actions.stopPrescription(rx.id);
            setSheet(null);
            toast.show('Prescription stopped');
          }}
        />
        <Button label="Keep going" variant="ghost" block onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet
        visible={correcting !== null}
        title="Change this dose result"
        onClose={() => setCorrecting(null)}
      >
        {correcting ? (
          <DoseRow
            medication={rx.medication}
            time={correcting.time}
            detail={`${dayLabel(correcting.date, today)} · logged ${correcting.status === 'taken' ? 'Taken' : 'Skipped'}`}
            status={correcting.status}
          />
        ) : null}
        <FieldGroup label="Result">
          <SegmentedControl
            segments={[
              { value: 'taken', label: 'Taken' },
              { value: 'skipped', label: 'Skipped' },
            ]}
            value={result}
            onChange={setResult}
            accessibilityLabel="Result"
          />
        </FieldGroup>
        <Textarea
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={500}
          placeholder="e.g. Gave it late, after she ate"
        />
        <AppText variant="caption" color={palette.text.secondary}>
          Each dose keeps one current result. Your change is recorded in the audit history.
        </AppText>
        <Button
          label="Save change"
          block
          onPress={() => {
            if (correcting)
              actions.logDose(rx.id, correcting.date, correcting.time, result, note.trim());
            setCorrecting(null);
            toast.show('Dose result updated');
          }}
        />
        <Button label="Cancel" variant="ghost" block onPress={() => setCorrecting(null)} />
      </BottomSheet>

      <DoseSheet occurrence={dose} onClose={() => setDose(null)} />
    </StackScreen>
  );
}
