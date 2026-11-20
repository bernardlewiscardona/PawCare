import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppointmentCard, PetHero } from '@/components/care-cards';
import { NotFound } from '@/components/not-found';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { DetailHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { DetailCard, ListItem, StatPill } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { ToggleRow } from '@/components/ui/toggle';
import { buildTimeline } from '@/lib/timeline';
import { byStart, isUpcomingVisit, openVaccineDues, petKind } from '@/lib/derive';
import { formatAge, formatDate, formatDayMonth, formatNumber, formatTime12h } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { Pet } from '@/lib/types';
import { color as palette, space } from '@/theme/tokens';
import { vaccineDueState } from '@/lib/care-status';

const TINT: Record<Pet['tint'], string> = {
  yellow: palette.tint.yellow,
  blue: palette.tint.blue,
  green: palette.tint.green,
  pink: palette.tint.pink,
};

function born(pet: Pet) {
  if (!pet.birthDate) return 'Birth date unknown';
  return pet.birthEstimated
    ? `Born about ${pet.birthDate.slice(0, 4)}`
    : `Born ${formatDate(pet.birthDate)}`;
}

/**
 * Figma: 20 Home & Pets / Pet profile (Active, Archived, Restored), Archive pet (Blocked,
 * Confirm) and Restore pet. PF-03 / PF-04.
 */
export default function PetProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, today, now, actions } = useStore();
  const toast = useToast();
  const [sheet, setSheet] = useState<'menu' | 'archive' | 'restore' | null>(null);
  const [remindersOn, setRemindersOn] = useState(false);
  const pet = state.pets.find((p) => p.id === id);
  if (!pet) return <NotFound />;

  const archived = Boolean(pet.archivedOn);
  const upcoming = state.visits
    .filter((v) => v.petId === pet.id && isUpcomingVisit(v, now))
    .sort(byStart);
  const records = buildTimeline(state, pet.id).filter((e) => !e.voided).length;
  const dueSoon = openVaccineDues(state.vaccines, pet.id).filter(
    (v) => vaccineDueState(v.nextDueOn as string, today).status !== 'upcoming',
  ).length;

  const details: [string, string][] = [
    ['Microchip', pet.microchip ?? 'Not recorded'],
    ['Weight measured', pet.weightMeasuredOn ? formatDate(pet.weightMeasuredOn) : 'Not recorded'],
    [
      'Birth date',
      pet.birthDate
        ? pet.birthEstimated
          ? `${pet.birthDate.slice(0, 4)} (estimated)`
          : formatDate(pet.birthDate)
        : 'Unknown',
    ],
    ['Owner', state.owner.displayName],
  ];

  const openPetScreen = (path: '/health' | '/visits', params?: Record<string, string>) => {
    actions.selectPet(pet.id);
    router.navigate(params ? { pathname: path, params } : path);
  };

  return (
    <StackScreen
      header={
        <DetailHeader
          title={pet.name}
          action={
            archived
              ? undefined
              : {
                  icon: 'more-horizontal',
                  label: `More actions for ${pet.name}`,
                  onPress: () => setSheet('menu'),
                }
          }
        />
      }
      bottomBar={
        archived ? (
          <Button label={`Restore ${pet.name}`} block onPress={() => setSheet('restore')} />
        ) : undefined
      }
    >
      {archived ? (
        <Banner
          tone="neutral"
          title={`${pet.name} is archived`}
          body={`History is read-only and ${pet.name} is hidden from pet selectors.`}
        />
      ) : null}
      {!archived && pet.remindersOff ? (
        <Banner
          tone="warning"
          title={`Reminders are off for ${pet.name}`}
          body={`They stayed off when you restored ${pet.name}. Turn them on to schedule future reminders.`}
          actionLabel="Turn on reminders"
          onAction={() => {
            actions.turnOnPetReminders(pet.id);
            toast.show(`Reminders on for ${pet.name}`);
          }}
        />
      ) : null}
      <PetHero
        name={pet.name}
        kind={petKind(pet)}
        born={born(pet)}
        avatar={pet.avatar}
        tint={TINT[pet.tint]}
        archived={archived}
      />
      <View style={styles.stats}>
        <StatPill label="Sex" value={pet.sex} />
        <StatPill label="Age" value={formatAge(pet.birthDate, pet.birthEstimated, today)} />
        <StatPill
          label="Weight"
          value={pet.weightKg ? `${formatNumber(pet.weightKg)} kg` : 'Not recorded'}
        />
      </View>
      <DetailCard rows={details} />
      {!archived ? (
        <>
          <SectionHeader title="Care" />
          <ListItem
            title="Health diary"
            subtitle={`${records} ${records === 1 ? 'record' : 'records'}`}
            illustration="report"
            onPress={() => openPetScreen('/health', { view: 'timeline' })}
          />
          <ListItem
            title="Vaccines & medication"
            subtitle={
              dueSoon
                ? `${dueSoon} ${dueSoon === 1 ? 'vaccine' : 'vaccines'} due soon`
                : 'Nothing due'
            }
            illustration="syringe"
            onPress={() => openPetScreen('/health', { view: 'care' })}
          />
          <ListItem
            title="Visits"
            subtitle={`${upcoming.length} upcoming`}
            illustration="calendar"
            onPress={() => openPetScreen('/visits')}
          />
        </>
      ) : null}

      <BottomSheet visible={sheet === 'menu'} title={pet.name} onClose={() => setSheet(null)}>
        <ListItem
          title="Edit profile"
          icon="pencil"
          onPress={() => {
            setSheet(null);
            router.push(`/pets/${pet.id}/edit`);
          }}
        />
        <ListItem
          title={`Archive ${pet.name}`}
          subtitle="Keep history, hide from selectors"
          icon="archive"
          onPress={() => setSheet('archive')}
        />
      </BottomSheet>

      {upcoming.length ? (
        <BottomSheet
          visible={sheet === 'archive'}
          title={`Can’t archive ${pet.name} yet`}
          onClose={() => setSheet(null)}
        >
          <Banner
            tone="warning"
            body={`${pet.name} has ${upcoming.length} upcoming ${upcoming.length === 1 ? 'visit' : 'visits'}. Cancel them in Visits first, then archive.`}
          />
          {upcoming.map((v) => {
            const { day, month } = formatDayMonth(v.date);
            return (
              <AppointmentCard
                key={v.id}
                day={day}
                month={month}
                title={v.title}
                subtitle={[v.provider, v.location].filter(Boolean).join(' · ')}
                time={formatTime12h(v.start)}
                status="planned"
                onPress={() => {
                  setSheet(null);
                  router.push(`/visits/${v.id}`);
                }}
              />
            );
          })}
          <Button
            label="Go to Visits"
            variant="secondary"
            block
            onPress={() => {
              setSheet(null);
              openPetScreen('/visits');
            }}
          />
        </BottomSheet>
      ) : (
        <BottomSheet
          visible={sheet === 'archive'}
          title={`Archive ${pet.name}?`}
          onClose={() => setSheet(null)}
        >
          <AppText variant="bodyM" color={palette.text.secondary}>
            {pet.name}’s history stays, read-only. {pet.name} is hidden from pet selectors and
            pending reminders stop. Household supplies used by {pet.name} are kept.
          </AppText>
          <Button
            label={`Archive ${pet.name}`}
            variant="destructive"
            block
            onPress={() => {
              actions.archivePet(pet.id);
              setSheet(null);
              toast.show(`${pet.name} archived`);
            }}
          />
          <Button label="Cancel" variant="ghost" block onPress={() => setSheet(null)} />
        </BottomSheet>
      )}

      <BottomSheet
        visible={sheet === 'restore'}
        title={`Restore ${pet.name}?`}
        onClose={() => setSheet(null)}
      >
        <AppText variant="bodyM" color={palette.text.secondary}>
          {pet.name} will appear in pet selectors again. Reminders that stopped when you archived
          stay off unless you turn them on.
        </AppText>
        <ToggleRow
          title="Turn reminders back on"
          helper="Creates future reminders only"
          value={remindersOn}
          onValueChange={setRemindersOn}
        />
        <Button
          label={`Restore ${pet.name}`}
          block
          onPress={() => {
            actions.restorePet(pet.id, remindersOn);
            setSheet(null);
            toast.show(`${pet.name} restored`);
          }}
        />
        <Button label="Cancel" variant="ghost" block onPress={() => setSheet(null)} />
      </BottomSheet>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space[2] + 2 },
});
