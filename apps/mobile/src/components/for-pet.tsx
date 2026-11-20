import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Dialog } from '@/components/ui/overlay';
import { PetPill } from '@/components/ui/pill';
import { useActivePets } from '@/lib/store';
import type { Pet } from '@/lib/types';
import { space } from '@/theme/tokens';

/**
 * "For [pet]" row on care forms. Switching pets with unsaved input requires an explicit
 * Discard (Figma: Pet switcher — Unsaved changes; PF-03) — a record never silently moves pets.
 */
export function ForPet({
  petId,
  onChange,
  dirty,
  recordLabel,
  locked = false,
}: {
  petId: string | undefined;
  onChange: (petId: string) => void;
  dirty: boolean;
  recordLabel: string;
  locked?: boolean;
}) {
  const pets = useActivePets();
  const [pending, setPending] = useState<Pet | null>(null);
  const current = pets.find((p) => p.id === petId);
  const shown = locked ? pets.filter((p) => p.id === petId) : pets;
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="For pet">
      <AppText variant="label">For</AppText>
      {shown.map((p) => (
        <PetPill
          key={p.id}
          name={p.name}
          avatar={p.avatar}
          selected={p.id === petId}
          disabled={locked}
          onPress={() => {
            if (p.id === petId) return;
            if (dirty) setPending(p);
            else onChange(p.id);
          }}
        />
      ))}
      <Dialog
        visible={pending !== null}
        tone="destructive"
        illustration="report"
        title="Discard changes?"
        body={`You haven’t saved ${current?.name ?? 'this pet'}’s ${recordLabel}. Switching to ${pending?.name ?? ''} will discard it.`}
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onChange(pending.id);
          setPending(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] + 2, flexWrap: 'wrap' },
});
