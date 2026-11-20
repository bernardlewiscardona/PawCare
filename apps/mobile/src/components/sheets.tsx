import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { IconTile, StatusBadge } from '@/components/ui/badges';
import { Button, ButtonRow } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';
import { BottomSheet } from '@/components/ui/overlay';
import { DatePicker, TimePicker } from '@/components/ui/pickers';
import { ListItem, SelectRow } from '@/components/ui/rows';
import { Stepper } from '@/components/ui/stepper';
import { doseBadge } from '@/lib/care-status';
import { consumptionOrder, petKind, supplyStats, type DoseOccurrence } from '@/lib/derive';
import {
  formatAge,
  formatDayMonthShort,
  formatNumber,
  formatTime12h,
  unitLabel,
} from '@/lib/format';
import { notePetSwitch } from '@/lib/motion';
import { useActivePets, useSelectedPet, useStore } from '@/lib/store';
import { color as palette, radius, space } from '@/theme/tokens';

/** "Switch pet" sheet (Figma: Pet switcher — Default). Archived pets never appear. */
export function PetSwitchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { today, state } = useStore();
  const pets = useActivePets();
  const { pet: selected, selectPet } = useSelectedPet();
  const archived = state.pets.filter((p) => p.archivedOn);
  return (
    <BottomSheet visible={visible} title="Switch pet" onClose={onClose}>
      {pets.map((p) => (
        <SelectRow
          key={p.id}
          title={p.name}
          subtitle={`${petKind(p)} · ${formatAge(p.birthDate, p.birthEstimated, today)}`}
          avatar={p.avatar}
          showAvatar
          selected={p.id === selected?.id}
          onPress={() => {
            if (p.id !== selected?.id) {
              const from = pets.findIndex((x) => x.id === selected?.id);
              notePetSwitch(pets.indexOf(p) > from ? 1 : -1);
            }
            selectPet(p.id);
            onClose();
          }}
        />
      ))}
      {archived.length ? (
        <AppText variant="caption" color={palette.text.secondary}>
          Archived pets, like {archived[0].name}, don’t appear here.
        </AppText>
      ) : null}
      <Button
        label="Manage pets"
        variant="secondary"
        block
        onPress={() => {
          onClose();
          router.push('/pets');
        }}
      />
    </BottomSheet>
  );
}

/** "Add to Mochi’s diary" chooser (Figma: Add record — Default). */
export function AddRecordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { pet } = useSelectedPet();
  const go = (path: '/records/new' | '/vaccines/new' | '/prescriptions/new' | '/visits/new') => {
    onClose();
    router.push(path);
  };
  return (
    <BottomSheet
      visible={visible}
      title={`Add to ${pet?.name ?? 'your pet'}’s diary`}
      onClose={onClose}
    >
      <ListItem
        title="Medical record"
        subtitle="Illness, procedure, lab result, vet notes"
        illustration="first-aid"
        onPress={() => go('/records/new')}
      />
      <ListItem
        title="Vaccine"
        subtitle="A shot given and its next due date"
        illustration="syringe"
        onPress={() => go('/vaccines/new')}
      />
      <ListItem
        title="Prescription"
        subtitle="Medication with dose times"
        illustration="pill-bottle"
        onPress={() => go('/prescriptions/new')}
      />
      <ListItem
        title="Visit"
        subtitle="A vet or grooming visit you booked"
        illustration="calendar"
        onPress={() => go('/visits/new')}
      />
    </BottomSheet>
  );
}

/** Date picker in a sheet with a Done button. */
export function DateSheet({
  visible,
  title,
  value,
  onDone,
  onClose,
  minDate,
  maxDate,
  marked,
  caption,
}: {
  visible: boolean;
  title: string;
  value?: string;
  onDone: (value: string) => void;
  onClose: () => void;
  minDate?: string;
  maxDate?: string;
  marked?: string[];
  caption?: string;
}) {
  const { today } = useStore();
  const [draft, setDraft] = useState(value);
  const [shownFor, setShownFor] = useState(visible);
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) setDraft(value);
  }
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <DatePicker
        value={draft}
        onChange={setDraft}
        today={today}
        minDate={minDate}
        maxDate={maxDate}
        marked={marked}
      />
      {caption ? (
        <AppText variant="caption" color={palette.text.secondary}>
          {caption}
        </AppText>
      ) : null}
      <Button label="Done" block disabled={!draft} onPress={() => draft && onDone(draft)} />
    </BottomSheet>
  );
}

/** Time picker in a sheet. */
export function TimeSheet({
  visible,
  title,
  value,
  onDone,
  onClose,
  caption,
  buttonLabel = 'Done',
}: {
  visible: boolean;
  title: string;
  value?: string;
  onDone: (value: string) => void;
  onClose: () => void;
  caption?: string;
  buttonLabel?: string;
}) {
  const [draft, setDraft] = useState(value ?? '09:00');
  const [shownFor, setShownFor] = useState(visible);
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) setDraft(value ?? '09:00');
  }
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <TimePicker value={draft} onChange={setDraft} />
      {caption ? (
        <AppText variant="caption" color={palette.text.secondary}>
          {caption}
        </AppText>
      ) : null}
      <Button label={buttonLabel} block onPress={() => onDone(draft)} />
    </BottomSheet>
  );
}

export type Option<T extends string> = { value: T; label: string; subtitle?: string };

/** Single-choice list in a sheet (select fields). */
export function SelectSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  value?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {options.map((o) => (
        <SelectRow
          key={o.value}
          title={o.label}
          subtitle={o.subtitle}
          selected={o.value === value}
          onPress={() => {
            onSelect(o.value);
            onClose();
          }}
        />
      ))}
    </BottomSheet>
  );
}

function whenLabel(date: string, time: string, today: string) {
  const day =
    date === today
      ? 'Today'
      : date < today
        ? Number(today.slice(8)) - Number(date.slice(8)) === 1
          ? 'Yesterday'
          : formatDayMonthShort(date)
        : formatDayMonthShort(date);
  return `${day}, ${formatTime12h(time)}`;
}

/**
 * Dose sheet (Figma: Dose sheet — Due/Overdue, Record stock use). Taken/Skipped is logged once;
 * stock changes only through the explicit second step (VC-03, shared requirement 8).
 */
export function DoseSheet({
  occurrence,
  onClose,
}: {
  occurrence: DoseOccurrence | null;
  onClose: () => void;
}) {
  const { state, today, now, actions } = useStore();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'log' | 'stock'>('log');
  const [qty, setQty] = useState(1);
  const [key, setKey] = useState<string | null>(null);
  const occKey = occurrence
    ? `${occurrence.prescriptionId}-${occurrence.date}-${occurrence.time}`
    : null;
  if (occKey !== key) {
    setKey(occKey);
    setNote(occurrence?.log?.note ?? '');
    setStep('log');
    setQty(1);
  }

  const rx = occurrence
    ? state.prescriptions.find((r) => r.id === occurrence.prescriptionId)
    : undefined;
  const pet = rx ? state.pets.find((p) => p.id === rx.petId) : undefined;
  const supply = rx?.supplyId
    ? state.supplies.find((s) => s.id === rx.supplyId && !s.archivedOn)
    : undefined;
  if (!occurrence || !rx)
    return (
      <BottomSheet visible={false} title="" onClose={onClose}>
        {null}
      </BottomSheet>
    );

  const badge = doseBadge(occurrence.status);
  const hoursLate =
    occurrence.status === 'overdue'
      ? Math.max(
          1,
          Math.round(
            ((occurrence.date < now.date ? 24 : 0) * 60 +
              toMin(now.time) -
              toMin(occurrence.time)) /
              60,
          ),
        )
      : 0;

  const log = (status: 'taken' | 'skipped') => {
    actions.logDose(rx.id, occurrence.date, occurrence.time, status, note.trim());
    if (status === 'taken' && supply) setStep('stock');
    else {
      toast.show(status === 'taken' ? 'Dose logged as taken' : 'Dose logged as skipped');
      onClose();
    }
  };

  if (step === 'stock' && supply) {
    const stats = supplyStats(supply, today);
    const batch = consumptionOrder(supply.batches, today)[0];
    const unit = unitLabel(supply.unit, qty);
    return (
      <BottomSheet visible title="Dose logged" onClose={onClose}>
        <Banner tone="success" body={`Taken at ${formatTime12h(now.time)}.`} />
        <AppText variant="bodyM" color={palette.text.secondary}>
          Record stock use too? Supplies only change when you say so.
        </AppText>
        <ListItem
          title={supply.name}
          subtitle={`${formatNumber(stats.usable)} ${unitLabel(supply.unit, stats.usable)} usable · linked supply`}
          illustration={supply.illustration}
        />
        <View style={styles.qtyRow}>
          <AppText variant="label" style={styles.grow}>
            Quantity used
          </AppText>
          <Stepper
            value={qty}
            onChange={setQty}
            unit={unit}
            min={1}
            max={Math.max(1, Math.floor(stats.usable))}
            label="Quantity used"
          />
        </View>
        <Button
          label={`Record ${qty} ${unit} used`}
          block
          disabled={!batch || qty > stats.usable}
          onPress={() => {
            if (!batch) return;
            actions.consume(supply.id, batch.id, qty, `${pet?.name ?? ''} · ${rx.medication}`);
            toast.show(`${qty} ${unit} recorded as used`);
            onClose();
          }}
        />
        <Button label="Not now" variant="ghost" block onPress={onClose} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible title={rx.medication} onClose={onClose}>
      <View style={styles.doseCard}>
        <IconTile illustration="pill-bottle" tone="green" />
        <View style={styles.grow}>
          <AppText variant="titleS">{whenLabel(occurrence.date, occurrence.time, today)}</AppText>
          <AppText variant="caption" color={palette.text.secondary}>
            {[pet?.name, rx.doseLabel ?? rx.instructions].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <StatusBadge status={badge.status} label={badge.label} />
      </View>
      {occurrence.status === 'overdue' ? (
        <Banner
          tone="danger"
          body={`This dose was due ${hoursLate} ${hoursLate === 1 ? 'hour' : 'hours'} ago. Log what happened so the course stays accurate.`}
        />
      ) : null}
      <Textarea
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Gave it hidden in a treat"
        maxLength={500}
      />
      <ButtonRow>
        <Button
          label="Skipped"
          variant="secondary"
          style={styles.grow}
          onPress={() => log('skipped')}
        />
        <Button label="Taken" icon="check" style={styles.grow} onPress={() => log('taken')} />
      </ButtonRow>
      <AppText variant="caption" color={palette.text.secondary}>
        Logging Taken doesn’t change your supplies. You can record stock use next.
      </AppText>
    </BottomSheet>
  );
}

function toMin(t: string) {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: space[1] },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  doseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.xl,
    backgroundColor: palette.bg.surface,
  },
});
