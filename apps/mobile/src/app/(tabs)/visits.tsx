import { router } from 'expo-router';
import { useState } from 'react';
import { AppointmentCard } from '@/components/care-cards';
import { AppText } from '@/components/ui/app-text';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { RootHeader } from '@/components/ui/header';
import { TabScreen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { byStart, visitDisplayStatus } from '@/lib/derive';
import { formatDayMonth, formatTime12h } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { Visit } from '@/lib/types';
import { color as palette } from '@/theme/tokens';

type Segment = 'upcoming' | 'needs-update' | 'history';

const SEGMENTS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'needs-update', label: 'Needs update' },
  { value: 'history', label: 'History' },
] as const;

/** Figma: 50 Appointments / Visits (Upcoming, Needs update, History, Empty). AP-02, all pets. */
export default function VisitsScreen() {
  const { state, now } = useStore();
  const [segment, setSegment] = useState<Segment>('upcoming');
  const petName = (id: string) => state.pets.find((p) => p.id === id)?.name ?? '';

  const upcoming = state.visits
    .filter((v) => visitDisplayStatus(v, now) === 'planned')
    .sort(byStart);
  const needsUpdate = state.visits
    .filter((v) => visitDisplayStatus(v, now) === 'needs-update')
    .sort(byStart);
  // History: newest appointment date first, ID tiebreak.
  const history = state.visits.filter((v) => v.status !== 'planned').sort((a, b) => -byStart(a, b));

  const list =
    segment === 'upcoming' ? upcoming : segment === 'needs-update' ? needsUpdate : history;
  const card = (v: Visit) => {
    const { day, month } = formatDayMonth(v.date);
    return (
      <AppointmentCard
        key={v.id}
        day={day}
        month={month}
        title={v.title}
        subtitle={`${petName(v.petId)} · ${v.provider}`}
        time={formatTime12h(v.start)}
        status={visitDisplayStatus(v, now)}
        onPress={() => router.push(`/visits/${v.id}`)}
      />
    );
  };

  return (
    <TabScreen
      header={
        <RootHeader
          title="Visits"
          actions={[
            { icon: 'plus', label: 'Log a visit', onPress: () => router.push('/visits/new') },
          ]}
        />
      }
    >
      {state.visits.length === 0 ? (
        <EmptyState
          illustration="calendar"
          title="No visits yet"
          body="Booked a vet or grooming visit? Log it here to get a reminder and keep it in your pet’s diary."
          actionLabel="Log a visit"
          onAction={() => router.push('/visits/new')}
        />
      ) : (
        <>
          <SegmentedControl
            segments={SEGMENTS}
            value={segment}
            onChange={setSegment}
            accessibilityLabel="Visits view"
          />
          {segment === 'upcoming' ? (
            <Banner
              tone="neutral"
              body="PawCare is a diary. Book with your clinic, then log the visit here."
            />
          ) : null}
          {segment === 'needs-update' && needsUpdate.length ? (
            <Banner
              tone="warning"
              title="Did this visit happen?"
              body={`Its time has passed. Record the outcome so ${petName(needsUpdate[0].petId)}’s diary stays accurate.`}
            />
          ) : null}
          {list.map(card)}
          {list.length === 0 ? (
            <AppText variant="bodyM" color={palette.text.secondary} align="center">
              {segment === 'upcoming'
                ? 'No upcoming visits.'
                : segment === 'needs-update'
                  ? 'Nothing needs an update.'
                  : 'No past visits yet.'}
            </AppText>
          ) : null}
        </>
      )}
    </TabScreen>
  );
}
