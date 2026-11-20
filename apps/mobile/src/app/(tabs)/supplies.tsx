import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, EmptyState, useToast } from '@/components/ui/feedback';
import { RootHeader } from '@/components/ui/header';
import { Chip } from '@/components/ui/pill';
import { SupplyRow } from '@/components/ui/rows';
import { BleedRow, TabScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { supplyStats } from '@/lib/derive';
import { formatNumber, formatQuantity, unitLabel } from '@/lib/format';
import { useActivePets, useStore } from '@/lib/store';

/** Figma: 60 Supplies / Supplies (Default, Filtered, Empty). Household items, shared by pets. */
export default function SuppliesScreen() {
  const { state, today } = useStore();
  const toast = useToast();
  const pets = useActivePets();
  const [petFilter, setPetFilter] = useState<string | undefined>();

  const active = state.supplies.filter((s) => !s.archivedOn);
  const shown = active.filter((s) => !petFilter || s.petIds.includes(petFilter));
  const low = active
    .map((s) => ({ s, stats: supplyStats(s, today) }))
    .find(({ stats }) => stats.alert === 'low-stock');
  const petNames = (ids: string[]) =>
    ids
      .map((id) => state.pets.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  const filterName = pets.find((p) => p.id === petFilter)?.name;

  return (
    <TabScreen
      header={
        <RootHeader
          title="Supplies"
          actions={[
            {
              icon: 'search',
              label: 'Search supplies',
              onPress: () => toast.show('Search arrives with the inventory API.', 'info'),
            },
            { icon: 'plus', label: 'Add an item', onPress: () => router.push('/supplies/new') },
          ]}
        />
      }
    >
      {active.length === 0 ? (
        <EmptyState
          illustration="box"
          title="No supplies yet"
          body="Track food, medicine and grooming supplies for the whole household. PawCare warns you when they run low or expire."
          actionLabel="Add an item"
          onAction={() => router.push('/supplies/new')}
        />
      ) : (
        <>
          {low && !petFilter ? (
            <Banner
              tone="warning"
              title={`${low.s.name} running low`}
              body={`${formatNumber(low.stats.usable)} usable ${unitLabel(low.s.unit, low.stats.usable)} left. Restock before you run out.`}
              actionLabel="Restock"
              onAction={() =>
                router.push({
                  pathname: '/supplies/[id]',
                  params: { id: low.s.id, sheet: 'restock' },
                })
              }
            />
          ) : null}
          <BleedRow>
            <Chip label="All pets" selected={!petFilter} onPress={() => setPetFilter(undefined)} />
            {pets.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={petFilter === p.id}
                onPress={() => setPetFilter(p.id)}
              />
            ))}
          </BleedRow>
          <SectionHeader
            title={
              filterName
                ? `${shown.length} ${shown.length === 1 ? 'item' : 'items'} used by ${filterName}`
                : `${shown.length} ${shown.length === 1 ? 'item' : 'items'}`
            }
          />
          {shown.map((s) => {
            const stats = supplyStats(s, today);
            return (
              <SupplyRow
                key={s.id}
                name={s.name}
                subtitle={`${s.category} · ${petNames(s.petIds) || 'Household'}`}
                illustration={s.illustration}
                quantity={formatQuantity(stats.usable, s.unit)}
                alert={stats.alert}
                onPress={() => router.push(`/supplies/${s.id}`)}
              />
            );
          })}
        </>
      )}
    </TabScreen>
  );
}
