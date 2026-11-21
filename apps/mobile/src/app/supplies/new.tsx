import { router } from 'expo-router';
import { useState } from 'react';
import { useDiscardGuard } from '@/components/discard-guard';
import { SelectSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { useToast } from '@/components/ui/feedback';
import { Field, FieldGroup } from '@/components/ui/field';
import { ModalHeader } from '@/components/ui/header';
import type { IllustrationName } from '@/components/ui/illustration';
import { Chip } from '@/components/ui/pill';
import { StackScreen, WrapRow } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { parseQuantity, unitLabel } from '@/lib/format';
import { useActivePets, useStore } from '@/lib/store';
import { SUPPLY_CATEGORIES, SUPPLY_UNITS, type SupplyCategory, type SupplyUnit } from '@/lib/types';
import { color as palette, space } from '@/theme/tokens';

const ART: Record<SupplyCategory, IllustrationName> = {
  Food: 'food-bag',
  Medication: 'pill-bottle',
  Supplement: 'vial',
  Grooming: 'shampoo',
  Other: 'box',
};

const LEADS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
] as const;

/** Figma: 60 Supplies / Item form (Empty, Filled, Error, Success). IN-01 / IN-04. */
export default function NewSupplyScreen() {
  const { actions } = useStore();
  const pets = useActivePets();
  const toast = useToast();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SupplyCategory | undefined>();
  const [unit, setUnit] = useState<SupplyUnit | undefined>();
  const [petIds, setPetIds] = useState<string[]>([]);
  const [alertAt, setAlertAt] = useState('');
  const [lead, setLead] = useState<'7' | '30'>('30');
  const [unitPicker, setUnitPicker] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<'name' | 'category' | 'unit' | 'alertAt', string>>
  >({});
  const guard = useDiscardGuard({ name, category, unit, petIds, alertAt, lead }, 'item');

  const save = () => {
    const next: typeof errors = {};
    if (!name.trim() || name.trim().length > 150) next.name = 'Enter the item name.';
    if (!category) next.category = 'Choose a category.';
    if (!unit) next.unit = 'Choose how you count it.';
    let threshold: number | undefined;
    if (alertAt.trim() && unit) {
      const q = parseQuantity(alertAt, unit, { allowZero: true });
      if (q.error) next.alertAt = q.error;
      threshold = q.value;
    }
    setErrors(next);
    if (Object.keys(next).length || !category || !unit) return;
    const id = actions.addSupply({
      name: name.trim(),
      category,
      unit,
      illustration: ART[category],
      petIds,
      alertAt: threshold,
      expiryLeadDays: lead === '7' ? 7 : 30,
    });
    toast.show('Item added');
    guard.leave(() => router.replace(`/supplies/${id}`));
  };

  return (
    <StackScreen
      layout="form"
      gap={space[2] + 2}
      header={<ModalHeader title="Add item" onAction={save} />}
    >
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Small-breed kibble"
        maxLength={150}
        error={errors.name}
      />
      <FieldGroup label="Category" error={errors.category}>
        <WrapRow>
          {SUPPLY_CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </WrapRow>
      </FieldGroup>
      <Field
        label="Unit"
        value={unit ?? ''}
        placeholder="Choose a unit"
        trailingIcon="chevron-down"
        helper="Locked after the first stock change."
        error={errors.unit}
        onPress={() => setUnitPicker(true)}
      />
      <FieldGroup label="Used by">
        <WrapRow>
          {pets.map((p) => {
            const on = petIds.includes(p.id);
            return (
              <Chip
                key={p.id}
                label={p.name}
                multi
                selected={on}
                onPress={() =>
                  setPetIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))
                }
              />
            );
          })}
        </WrapRow>
      </FieldGroup>
      <Field
        label="Low-stock alert at (optional)"
        value={alertAt}
        onChangeText={setAlertAt}
        placeholder="Quantity"
        suffix={unit ? unitLabel(unit, Number(alertAt) || 2) : 'units'}
        keyboardType="decimal-pad"
        helper="We’ll warn you when usable stock falls to this."
        error={errors.alertAt}
      />
      <FieldGroup label="Warn before expiry">
        <SegmentedControl
          segments={LEADS}
          value={lead}
          onChange={setLead}
          accessibilityLabel="Warn before expiry"
        />
      </FieldGroup>
      <AppText variant="caption" color={palette.text.secondary}>
        New items start at 0. Add stock with Restock after saving.
      </AppText>
      <SelectSheet
        visible={unitPicker}
        title="Unit"
        options={SUPPLY_UNITS.map((u) => ({ value: u, label: u }))}
        value={unit}
        onSelect={setUnit}
        onClose={() => setUnitPicker(false)}
      />
      {guard.dialog}
    </StackScreen>
  );
}
