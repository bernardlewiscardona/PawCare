import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  DoseRow,
  PrescriptionCard,
  RecordCard,
  TimelineRow,
  VaccineRow,
} from '@/components/care-cards';
import { PetRow, PetTransition } from '@/components/pet-row';
import { AddRecordSheet, DoseSheet } from '@/components/sheets';
import { EmptyState, Skeleton, useToast } from '@/components/ui/feedback';
import { RootHeader } from '@/components/ui/header';
import { Chip } from '@/components/ui/pill';
import { BleedRow, TabScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { InlineToggle } from '@/components/ui/toggle';
import { vaccineDueState } from '@/lib/care-status';
import { dosesOn, openVaccineDues, prescriptionState, type DoseOccurrence } from '@/lib/derive';
import { formatDateRange, formatDayMonth, formatDayMonthShort, formatTime12h } from '@/lib/format';
import { useActivePets, useSelectedPet, useStore } from '@/lib/store';
import { buildTimeline, MODE_LABEL } from '@/lib/timeline';
import { space, type RecordKind } from '@/theme/tokens';

type HealthView = 'timeline' | 'care';

const SEGMENTS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'care', label: 'Vaccines & meds' },
] as const;

const FILTERS: { label: string; kind?: RecordKind }[] = [
  { label: 'All' },
  { label: 'Medical', kind: 'medical' },
  { label: 'Vaccines', kind: 'vaccine' },
  { label: 'Medication', kind: 'prescription' },
  { label: 'Visits', kind: 'visit' },
];

/** Figma: 30 Health Diary / Timeline and 40 Vaccines & Meds / Care overview. */
export default function HealthScreen() {
  const toast = useToast();
  const params = useLocalSearchParams<{ view?: string; filter?: string }>();
  const [view, setView] = useState<HealthView>(params.view === 'care' ? 'care' : 'timeline');
  const [filter, setFilter] = useState<RecordKind | undefined>();
  const [addRecord, setAddRecord] = useState(false);
  const { pet } = useSelectedPet();
  const order = useActivePets().findIndex((p) => p.id === pet?.id);

  // Deep links from Home ("Vaccines") and from "All vaccines" pick a segment/filter.
  const [linked, setLinked] = useState(`${params.view}|${params.filter}`);
  if (`${params.view}|${params.filter}` !== linked) {
    setLinked(`${params.view}|${params.filter}`);
    if (params.view === 'care' || params.view === 'timeline') setView(params.view);
    if (params.filter) setFilter(params.filter as RecordKind);
  }

  return (
    <TabScreen
      header={
        <RootHeader
          title="Health"
          actions={[
            {
              icon: 'search',
              label: 'Search records',
              onPress: () => toast.show('Search arrives with the records API.', 'info'),
            },
            { icon: 'plus', label: 'Add a health record', onPress: () => setAddRecord(true) },
          ]}
        />
      }
    >
      <PetRow />
      <SegmentedControl
        segments={SEGMENTS}
        value={view}
        onChange={setView}
        accessibilityLabel="Health view"
      />
      <PetTransition petId={pet?.id} order={order} gap={space[3]}>
        {view === 'timeline' ? (
          <TimelineView filter={filter} setFilter={setFilter} onAdd={() => setAddRecord(true)} />
        ) : (
          <CareOverview
            onShowVaccines={() => {
              setFilter('vaccine');
              setView('timeline');
            }}
          />
        )}
      </PetTransition>
      <AddRecordSheet visible={addRecord} onClose={() => setAddRecord(false)} />
    </TabScreen>
  );
}

function TimelineView({
  filter,
  setFilter,
  onAdd,
}: {
  filter: RecordKind | undefined;
  setFilter: (k: RecordKind | undefined) => void;
  onAdd: () => void;
}) {
  const { state } = useStore();
  const { pet } = useSelectedPet();
  const [showVoided, setShowVoided] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const all = buildTimeline(state, pet?.id);
  const entries = all.filter((e) => (!filter || e.kind === filter) && (showVoided || !e.voided));

  if (!loading && all.length === 0) {
    return (
      <EmptyState
        illustration="paw"
        title={`No records for ${pet?.name ?? 'this pet'} yet`}
        body={`Add a vet visit, vaccine or prescription to start ${pet?.name ?? 'your pet'}’s health diary.`}
        actionLabel="Add record"
        onAction={onAdd}
      />
    );
  }

  return (
    <>
      <BleedRow>
        {FILTERS.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            selected={filter === f.kind}
            onPress={() => setFilter(f.kind)}
          />
        ))}
      </BleedRow>
      <InlineToggle label="Show voided records" value={showVoided} onValueChange={setShowVoided} />
      {loading ? (
        <View
          style={styles.list}
          accessible
          accessibilityLabel="Loading"
          accessibilityRole="progressbar"
        >
          <Skeleton height={130} />
          <Skeleton height={130} />
          <Skeleton height={130} />
        </View>
      ) : entries.length === 0 ? (
        <EmptyState
          illustration="report"
          title="Nothing matches"
          body="Try another filter, or show voided records."
        />
      ) : (
        <View style={styles.list}>
          {entries.map((e) => {
            const { day, month } = formatDayMonth(e.date);
            return (
              <TimelineRow key={e.id} day={day} month={month}>
                <RecordCard
                  kind={e.kind}
                  context={e.context}
                  title={e.title}
                  body={e.body}
                  meta={e.meta}
                  voided={e.voided}
                  onPress={() => router.push(e.href as Href)}
                />
              </TimelineRow>
            );
          })}
        </View>
      )}
    </>
  );
}

function CareOverview({ onShowVaccines }: { onShowVaccines: () => void }) {
  const { state, today, now } = useStore();
  const { pet } = useSelectedPet();
  const [dose, setDose] = useState<DoseOccurrence | null>(null);

  const rxs = state.prescriptions.filter((r) => r.petId === pet?.id);
  const live = rxs.filter((r) => ['active', 'upcoming'].includes(prescriptionState(r, today)));
  const doses = live
    .flatMap((rx) => dosesOn(rx, state.doseLogs, today, now).map((o) => ({ o, rx })))
    .sort((a, b) => a.o.time.localeCompare(b.o.time) || a.rx.id.localeCompare(b.rx.id));
  // Overdue first, then due today and the next 30 days (VC-04).
  const dues = openVaccineDues(state.vaccines, pet?.id)
    .map((v) => ({ v, s: vaccineDueState(v.nextDueOn as string, today) }))
    .filter(({ s }) => s.status !== 'upcoming')
    .sort((a, b) => Number(b.s.status === 'overdue') - Number(a.s.status === 'overdue'));

  if (!doses.length && !dues.length && !live.length) {
    return (
      <EmptyState
        illustration="vial"
        title={`Nothing to track for ${pet?.name ?? 'this pet'}`}
        body="Record a vaccine with its next due date, or a prescription with dose times, and PawCare will remind you."
        actionLabel="Add vaccine"
        onAction={() => router.push('/vaccines/new')}
      />
    );
  }

  return (
    <View style={styles.sections}>
      {doses.length ? (
        <View style={styles.list}>
          <SectionHeader
            title="Today’s doses"
            actionLabel="History"
            onActionPress={() => router.push(`/prescriptions/${doses[0].rx.id}`)}
          />
          {doses.map(({ o, rx }) => (
            <DoseRow
              key={`${rx.id}-${o.time}`}
              medication={rx.medication}
              time={o.time}
              detail={
                o.log?.status === 'taken' && o.log.at
                  ? `Taken at ${formatTime12h(o.log.at)} · ${rx.doseLabel ?? rx.instructions}`
                  : (rx.doseLabel ?? rx.instructions)
              }
              status={o.status}
              onPress={() => setDose(o)}
            />
          ))}
        </View>
      ) : null}
      {dues.length ? (
        <View style={styles.list}>
          <SectionHeader
            title="Vaccines due"
            actionLabel="All vaccines"
            onActionPress={onShowVaccines}
          />
          {dues.map(({ v, s }) => (
            <VaccineRow
              key={v.id}
              name={v.name}
              detail={s.detail}
              status={s.status}
              onPress={() => router.push(`/vaccines/${v.id}`)}
            />
          ))}
        </View>
      ) : null}
      {live.length ? (
        <View style={styles.list}>
          <SectionHeader title="Prescriptions" />
          {live.map((rx) => (
            <PrescriptionCard
              key={rx.id}
              medication={rx.medication}
              instructions={rx.instructions}
              state={prescriptionState(rx, today)}
              modeLabel={MODE_LABEL[rx.mode]}
              timesLabel={rx.times.length ? rx.times.map(formatTime12h).join(' · ') : undefined}
              dateRange={
                rx.endDate
                  ? formatDateRange(rx.startDate, rx.endDate)
                  : `From ${formatDayMonthShort(rx.startDate)}`
              }
              onPress={() => router.push(`/prescriptions/${rx.id}`)}
            />
          ))}
        </View>
      ) : null}
      <DoseSheet occurrence={dose} onClose={() => setDose(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3] },
  sections: { gap: space[3] },
});
