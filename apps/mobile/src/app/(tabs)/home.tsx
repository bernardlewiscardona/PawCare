import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DoseRow, NextVisitCard, QuickAction, VaccineRow } from '@/components/care-cards';
import { PetRow, PetTransition } from '@/components/pet-row';
import { AddRecordSheet, DoseSheet, PetSwitchSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { IconTile } from '@/components/ui/badges';
import { Banner, Skeleton } from '@/components/ui/feedback';
import { IconButton } from '@/components/ui/icon-button';
import { TabScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { vaccineDueState } from '@/lib/care-status';
import {
  byStart,
  dosesOn,
  firstName,
  isUpcomingVisit,
  openVaccineDues,
  prescriptionState,
  type DoseOccurrence,
} from '@/lib/derive';
import { formatLongDate, formatShortDate, formatTime12h } from '@/lib/format';
import { useActivePets, useSelectedPet, useStore } from '@/lib/store';
import { color as palette, radius, space } from '@/theme/tokens';

/** Figma: 20 Home & Pets / Home (Default, Nothing due, Loading) and Pet switcher. */
export default function HomeScreen() {
  const { state, today, now } = useStore();
  const { pet } = useSelectedPet();
  const order = useActivePets().findIndex((p) => p.id === pet?.id);
  const [loading, setLoading] = useState(true);
  const [switcher, setSwitcher] = useState(false);
  const [addRecord, setAddRecord] = useState(false);
  const [dose, setDose] = useState<DoseOccurrence | null>(null);

  // Stand-in for the first fetch so the designed loading state is exercised.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const nextVisit = state.visits
    .filter((v) => v.petId === pet?.id && isUpcomingVisit(v, now))
    .sort(byStart)[0];
  const rxs = state.prescriptions.filter(
    (r) => r.petId === pet?.id && prescriptionState(r, today) === 'active',
  );
  const openDoses = rxs
    .flatMap((rx) => dosesOn(rx, state.doseLogs, today, now).map((o) => ({ o, rx })))
    .filter(({ o }) => o.status !== 'taken' && o.status !== 'skipped')
    .sort((a, b) => a.o.time.localeCompare(b.o.time));
  const dues = openVaccineDues(state.vaccines, pet?.id)
    .map((v) => ({ v, s: vaccineDueState(v.nextDueOn as string, today) }))
    .filter(({ s }) => s.status !== 'upcoming')
    .sort((a, b) => Number(a.s.status === 'overdue') - Number(b.s.status === 'overdue'));
  const nothingDue = openDoses.length === 0 && dues.length === 0;

  return (
    <TabScreen gap={space[3] + 2} paddingTop={space[1] + 2}>
      <View style={styles.greeting}>
        <Avatar avatar={state.owner.avatar} size={44} />
        <View style={styles.grow}>
          <AppText variant="caption" color={palette.text.secondary}>
            {formatLongDate(today)}
          </AppText>
          <AppText variant="titleL" accessibilityRole="header">
            Hello, {firstName(state.owner.displayName)}
          </AppText>
        </View>
        <IconButton
          icon="settings"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        />
      </View>

      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          <PetRow showAdd onActivePress={() => setSwitcher(true)} />

          {pet && nextVisit ? (
            <PetTransition petId={pet.id} order={order} animateOnMount>
              <NextVisitCard
                title={nextVisit.title}
                place={[nextVisit.provider, nextVisit.location].filter(Boolean).join(' · ')}
                date={formatShortDate(nextVisit.date)}
                time={formatTime12h(nextVisit.start)}
                avatar={pet.avatar}
                petName={pet.name}
                onPress={() => router.push(`/visits/${nextVisit.id}`)}
              />
            </PetTransition>
          ) : null}

          <View style={styles.actions}>
            <QuickAction
              label="Add record"
              illustration="report"
              tint={palette.tint.pink}
              onPress={() => setAddRecord(true)}
            />
            <QuickAction
              label="Vaccines"
              illustration="syringe"
              tint={palette.tint.blue}
              onPress={() => router.navigate({ pathname: '/health', params: { view: 'care' } })}
            />
            <QuickAction
              label="Log visit"
              illustration="calendar"
              tint={palette.tint.yellow}
              onPress={() => router.push('/visits/new')}
            />
            <QuickAction
              label="Supplies"
              illustration="food-bag"
              tint={palette.tint.green}
              onPress={() => router.navigate('/supplies')}
            />
          </View>

          <PetTransition petId={pet?.id} order={order} gap={space[3] + 2}>
            {nothingDue ? (
              <View style={styles.caughtUp}>
                <IconTile illustration="paw" size="medium" />
                <View style={styles.grow}>
                  <AppText variant="titleS">All caught up</AppText>
                  <AppText variant="caption" color={palette.text.secondary}>
                    No doses, vaccines or visits due for {pet?.name ?? 'your pet'} today.
                  </AppText>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <SectionHeader
                  title={`Today for ${pet?.name ?? 'your pet'}`}
                  actionLabel="Inbox"
                  onActionPress={() => router.navigate('/inbox')}
                />
                {openDoses.map(({ o, rx }) => (
                  <DoseRow
                    key={`${rx.id}-${o.time}`}
                    medication={rx.medication}
                    time={o.time}
                    detail={[pet?.name, rx.doseLabel ?? rx.instructions]
                      .filter(Boolean)
                      .join(' · ')}
                    status={o.status}
                    onPress={() => setDose(o)}
                  />
                ))}
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
            )}

            {pet && !nextVisit ? (
              <Banner
                tone="neutral"
                title="No upcoming visits"
                body={`Booked a visit with your vet? Add it to ${pet.name}’s diary.`}
                actionLabel="Log a visit"
                onAction={() => router.push('/visits/new')}
              />
            ) : null}
          </PetTransition>
        </>
      )}

      <PetSwitchSheet visible={switcher} onClose={() => setSwitcher(false)} />
      <AddRecordSheet visible={addRecord} onClose={() => setAddRecord(false)} />
      <DoseSheet occurrence={dose} onClose={() => setDose(null)} />
    </TabScreen>
  );
}

function HomeSkeleton() {
  return (
    <View
      style={styles.skeleton}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <View style={styles.row8}>
        <Skeleton width={100} height={40} />
        <Skeleton width={100} height={40} />
      </View>
      <Skeleton height={180} />
      <View style={styles.row8}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.grow}>
            <Skeleton height={90} />
          </View>
        ))}
      </View>
      <Skeleton shape="line" width={120} height={14} />
      <Skeleton height={64} />
      <Skeleton height={64} />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  section: { gap: space[3] },
  caughtUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3] + 2,
    padding: space[4],
    borderRadius: radius.xl,
    backgroundColor: palette.bg.surface,
  },
  skeleton: { gap: space[3] + 2 },
  row8: { flexDirection: 'row', gap: space[2] },
});
