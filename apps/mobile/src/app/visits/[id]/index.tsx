import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AppointmentCard, RecordHero } from '@/components/care-cards';
import { NotFound } from '@/components/not-found';
import { AppText } from '@/components/ui/app-text';
import { KindTag, StatusBadge } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { DetailCard, ListItem } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { visitDisplayStatus } from '@/lib/derive';
import {
  formatDate,
  formatDayMonth,
  formatShortDateYear,
  formatTime12h,
  formatTimeRange,
} from '@/lib/format';
import { useStore } from '@/lib/store';
import { color as palette } from '@/theme/tokens';

/** AP-04 exact copy. */
const DIARY_CANCEL = 'This cancels the diary entry only. Contact your clinic separately.';

/**
 * Figma: 50 Appointments / Visit detail (Planned, Needs update, Completed, Missed, Canceled),
 * Cancel visit and Record outcome. AP-03 … AP-05. Terminal entries are read-only.
 */
export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, now, actions } = useStore();
  const toast = useToast();
  const [sheet, setSheet] = useState<'menu' | 'cancel' | 'outcome' | null>(null);
  const [reason, setReason] = useState('');
  const visit = state.visits.find((v) => v.id === id);
  if (!visit) return <NotFound title="Visit" />;

  const pet = state.pets.find((p) => p.id === visit.petId);
  const status = visitDisplayStatus(visit, now);
  const open = status === 'planned' || status === 'needs-update';
  const notes = state.medical.filter((m) => m.linkedVisitId === visit.id && !m.voidedOn);
  const { day, month } = formatDayMonth(visit.date);

  const rows: [string, string][] = [
    ['Pet', pet?.name ?? '—'],
    ['Provider', visit.provider],
    ...(visit.contact ? [['Contact', visit.contact] as [string, string]] : []),
    ...(visit.location ? [['Location', visit.location] as [string, string]] : []),
    ['Time zone', visit.timeZone],
    ['Notes', visit.notes ?? '—'],
  ];

  return (
    <StackScreen
      header={
        <DetailHeader
          title="Visit"
          action={
            open
              ? { icon: 'more-horizontal', label: 'More actions', onPress: () => setSheet('menu') }
              : undefined
          }
        />
      }
      bottomBar={
        status === 'planned' ? (
          <>
            <Button
              label="Edit visit"
              icon="pencil"
              variant="secondary"
              block
              onPress={() => router.push(`/visits/${visit.id}/edit`)}
            />
            <Button label="Cancel visit" variant="ghost" block onPress={() => setSheet('cancel')} />
          </>
        ) : status === 'needs-update' ? (
          <>
            <Button label="Record outcome" block onPress={() => setSheet('outcome')} />
            <Button label="Cancel visit" variant="ghost" block onPress={() => setSheet('cancel')} />
          </>
        ) : status === 'missed' ? (
          <Button
            label="Log a new visit"
            icon="plus"
            variant="secondary"
            block
            onPress={() => router.push('/visits/new')}
          />
        ) : undefined
      }
    >
      {status === 'needs-update' ? (
        <Banner
          tone="warning"
          title="This visit’s time has passed"
          body={`Did ${pet?.name} go? Record the outcome to update the diary.`}
        />
      ) : status === 'canceled' ? (
        <Banner
          tone="neutral"
          title={`Canceled on ${formatDate(visit.canceledOn as string)}`}
          body={`${visit.cancelReason ? `Reason: ${visit.cancelReason} ` : ''}Canceled visits are read-only.`}
        />
      ) : status === 'missed' ? (
        <Banner
          tone="neutral"
          title={`Marked missed on ${formatDate(visit.outcomeOn as string)}`}
          body="Missed visits stay in history. Log a new visit if you rebook."
        />
      ) : null}
      <RecordHero
        tint={palette.kind.visit}
        muted={!open}
        tags={
          <>
            {open ? <KindTag kind="visit" /> : null}
            <StatusBadge status={status} />
          </>
        }
        title={visit.title}
        meta={[
          { icon: 'calendar', label: formatShortDateYear(visit.date) },
          { icon: 'clock', label: formatTimeRange(visit.start, visit.end) },
        ]}
      />
      <DetailCard rows={rows} />
      {status === 'completed' ? (
        <>
          <SectionHeader title="Visit notes" />
          {notes.map((m) => (
            <ListItem
              key={m.id}
              title={m.title}
              subtitle="Medical record · linked to this visit"
              illustration="first-aid"
              onPress={() => router.push(`/records/${m.id}`)}
            />
          ))}
          <Button
            label="Add visit notes"
            icon="plus"
            variant="secondary"
            block
            onPress={() => router.push({ pathname: '/records/new', params: { visit: visit.id } })}
          />
          <AppText variant="caption" color={palette.text.secondary}>
            Marking a visit completed doesn’t add or verify any findings. Add notes as a medical
            record.
          </AppText>
        </>
      ) : null}

      <BottomSheet visible={sheet === 'menu'} title={visit.title} onClose={() => setSheet(null)}>
        {status === 'planned' ? (
          <ListItem
            title="Edit visit"
            icon="pencil"
            onPress={() => {
              setSheet(null);
              router.push(`/visits/${visit.id}/edit`);
            }}
          />
        ) : (
          <ListItem
            title="Record outcome"
            icon="circle-check"
            onPress={() => setSheet('outcome')}
          />
        )}
        <ListItem
          title="Cancel visit"
          subtitle="Keeps it in history"
          icon="x"
          onPress={() => setSheet('cancel')}
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'cancel'}
        title="Cancel this visit?"
        onClose={() => setSheet(null)}
      >
        <AppText variant="bodyM" color={palette.text.secondary}>
          {DIARY_CANCEL} Its reminders stop.
        </AppText>
        <Textarea
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Rescheduling after the holidays"
          maxLength={500}
        />
        <Button
          label="Cancel visit"
          variant="destructive"
          block
          onPress={() => {
            actions.cancelVisit(visit.id, reason.trim());
            setSheet(null);
            toast.show('Visit canceled in your diary');
          }}
        />
        <Button label="Keep visit" variant="ghost" block onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'outcome'}
        title={`Did ${pet?.name} go to this visit?`}
        onClose={() => setSheet(null)}
      >
        <AppointmentCard
          day={day}
          month={month}
          title={visit.title}
          subtitle={`${pet?.name} · ${visit.provider}`}
          time={formatTime12h(visit.start)}
          status={status}
        />
        <Button
          label={`Yes, ${pet?.name} went`}
          icon="check"
          block
          onPress={() => {
            actions.recordOutcome(visit.id, 'completed');
            setSheet(null);
            toast.show('Marked completed');
          }}
        />
        <Button
          label="No, we missed it"
          variant="secondary"
          block
          onPress={() => {
            actions.recordOutcome(visit.id, 'missed');
            setSheet(null);
            toast.show('Marked missed');
          }}
        />
        <AppText variant="caption" color={palette.text.secondary}>
          Completed visits join {pet?.name}’s timeline. You can add visit notes after.
        </AppText>
      </BottomSheet>
    </StackScreen>
  );
}
