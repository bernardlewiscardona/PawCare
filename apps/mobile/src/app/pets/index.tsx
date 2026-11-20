import { router } from 'expo-router';
import { AppText } from '@/components/ui/app-text';
import { DetailHeader } from '@/components/ui/header';
import { PetCard } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { petKind } from '@/lib/derive';
import { formatAge, formatDate } from '@/lib/format';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

/** Figma: 20 Home & Pets / My pets — Default. */
export default function MyPetsScreen() {
  const { state, today } = useStore();
  const active = state.pets.filter((p) => !p.archivedOn);
  const archived = state.pets.filter((p) => p.archivedOn);
  return (
    <StackScreen
      header={
        <DetailHeader
          title="My pets"
          action={{ icon: 'plus', label: 'Add pet', onPress: () => router.push('/pets/new') }}
        />
      }
      gap={space[3]}
    >
      <SectionHeader title={`Active · ${active.length}`} />
      {active.map((p) => (
        <PetCard
          key={p.id}
          name={p.name}
          subtitle={`${petKind(p)} · ${formatAge(p.birthDate, p.birthEstimated, today)}`}
          avatar={p.avatar}
          onPress={() => router.push(`/pets/${p.id}`)}
        />
      ))}
      {archived.length ? (
        <>
          <SectionHeader title={`Archived · ${archived.length}`} />
          {archived.map((p) => (
            <PetCard
              key={p.id}
              name={p.name}
              subtitle={`${petKind(p)} · archived ${formatDate(p.archivedOn as string)}`}
              avatar={p.avatar}
              archived
              onPress={() => router.push(`/pets/${p.id}`)}
            />
          ))}
          <AppText variant="caption" color={palette.text.secondary}>
            Archived pets keep their history but don’t appear in pet selectors or reminders.
          </AppText>
        </>
      ) : null}
    </StackScreen>
  );
}
