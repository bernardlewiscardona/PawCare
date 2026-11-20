import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RecordHero } from '@/components/care-cards';
import { NotFound } from '@/components/not-found';
import { DateSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { StatusBadge, TypeTag } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { Field, FieldGroup, Textarea } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { PetPill } from '@/components/ui/pill';
import { BatchRow, Card, LedgerRow, SelectRow, StatPill } from '@/components/ui/rows';
import { FieldRow, StackScreen, WrapRow, half } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Stepper } from '@/components/ui/stepper';
import { batchState, consumptionOrder, round, supplyStats } from '@/lib/derive';
import {
  formatDate,
  formatNumber,
  formatQuantity,
  formatSignedQuantity,
  formatWhen,
  isDiscreteUnit,
  parseQuantity,
  unitLabel,
} from '@/lib/format';
import { useStore } from '@/lib/store';
import type { Batch, LedgerEntry, SupplyCategory } from '@/lib/types';
import { color as palette, radius, space } from '@/theme/tokens';

const TINT: Record<SupplyCategory, string> = {
  Medication: palette.kind.prescription,
  Grooming: palette.tint.blue,
  Food: palette.tint.yellow,
  Supplement: palette.tint.pink,
  Other: palette.bg.surface,
};

type Sheet = 'restock' | 'use' | 'dispose' | 'reverse' | 'archive' | null;

/**
 * Figma: 60 Supplies / Item detail (Default, Low stock, Archived), Restock, Use, Dispose or
 * adjust, Reverse and Archive item. IN-02 … IN-04: every change is a new ledger entry; balances
 * never go below zero; nothing here is triggered by a dose log.
 */
export default function SupplyDetailScreen() {
  const { id, sheet: initialSheet } = useLocalSearchParams<{ id: string; sheet?: string }>();
  const { state, today, actions } = useStore();
  const toast = useToast();
  const [sheet, setSheet] = useState<Sheet>(initialSheet === 'restock' ? 'restock' : null);
  const [mode, setMode] = useState<'dispose' | 'adjust'>('dispose');
  const [entry, setEntry] = useState<LedgerEntry | null>(null);
  const supply = state.supplies.find((s) => s.id === id);
  if (!supply) return <NotFound title="Supply" />;

  const stats = supplyStats(supply, today);
  const archived = Boolean(supply.archivedOn);
  const live = supply.batches.filter((b) => b.quantity > 0);
  const users = supply.petIds
    .map((pid) => state.pets.find((p) => p.id === pid)?.name)
    .filter(Boolean)
    .join(', ');

  const openDispose = (m: 'dispose' | 'adjust') => {
    setMode(m);
    setSheet('dispose');
  };

  return (
    <StackScreen
      gap={space[3]}
      header={
        <DetailHeader
          title="Supply"
          action={
            archived
              ? undefined
              : {
                  icon: 'more-horizontal',
                  label: 'Archive item',
                  onPress: () => setSheet('archive'),
                }
          }
        />
      }
    >
      {archived ? (
        <Banner
          tone="neutral"
          title={`Archived on ${formatDate(supply.archivedOn as string)}`}
          body="Archived items keep their history. Stock was 0 when archived."
        />
      ) : null}
      <RecordHero
        tint={TINT[supply.category]}
        muted={archived}
        tags={
          <>
            <TypeTag label={supply.category} />
            {archived ? <StatusBadge status="archived" /> : null}
          </>
        }
        title={supply.name}
        body={`Used by ${users || 'the household'} · counted in ${unitLabel(supply.unit, 2)}`}
      />
      <View style={styles.stats}>
        <StatPill label="Physical" value={formatQuantity(stats.physical, supply.unit)} />
        <StatPill label="Usable" value={formatQuantity(stats.usable, supply.unit)} />
        <StatPill
          label="Alert at"
          value={
            supply.alertAt !== undefined ? formatQuantity(supply.alertAt, supply.unit) : 'Not set'
          }
        />
      </View>
      {!archived && live.length === 0 ? (
        <Banner
          tone="info"
          title="No stock yet"
          body="Restock to add your first batch."
          actionLabel="Restock"
          onAction={() => setSheet('restock')}
        />
      ) : null}
      {!archived && stats.alert === 'low-stock' && live.length ? (
        <Banner
          tone="warning"
          title="Low stock"
          body={`${formatNumber(stats.usable)} usable ${unitLabel(supply.unit, stats.usable)} left, at or below your alert of ${supply.alertAt}.`}
          actionLabel="Restock"
          onAction={() => setSheet('restock')}
        />
      ) : null}
      {!archived
        ? stats.expiredBatches.map((b) => (
            <Banner
              key={b.id}
              tone="danger"
              title="Expired batch"
              body={`Batch ${b.label} expired on ${formatDate(b.expiresOn as string)}. Expired stock can’t be used.`}
              actionLabel="Dispose"
              onAction={() => openDispose('dispose')}
            />
          ))
        : null}
      {!archived ? (
        <WrapRow>
          <Button
            label="Restock"
            icon="plus"
            size="small"
            variant="secondary"
            onPress={() => setSheet('restock')}
          />
          <Button
            label="Use"
            icon="minus"
            size="small"
            variant="secondary"
            disabled={stats.usable <= 0}
            onPress={() => setSheet('use')}
          />
          <Button
            label="Dispose"
            icon="trash"
            size="small"
            variant="secondary"
            disabled={!live.length}
            onPress={() => openDispose('dispose')}
          />
          <Button
            label="Adjust"
            icon="sliders"
            size="small"
            variant="secondary"
            disabled={!supply.batches.length}
            onPress={() => openDispose('adjust')}
          />
        </WrapRow>
      ) : null}
      {live.length ? (
        <>
          <SectionHeader title="Batches" />
          {live.map((b) => {
            const s = batchState(b, supply.expiryLeadDays, today);
            return (
              <BatchRow
                key={b.id}
                label={`Batch ${b.label}`}
                expiry={
                  b.expiresOn
                    ? `${s === 'expired' ? 'Expired' : 'Expires'} ${formatDate(b.expiresOn)}`
                    : 'No expiry date'
                }
                quantity={formatQuantity(b.quantity, supply.unit)}
                status={s}
              />
            );
          })}
        </>
      ) : null}
      <SectionHeader title="Activity" />
      <Card padded="ledger">
        {supply.ledger.map((l) => (
          <LedgerRow
            key={l.id}
            type={l.type}
            detail={`${formatWhen(l.date, l.time)} · ${l.detail}`}
            quantity={formatSignedQuantity(l.quantity, supply.unit)}
            onPress={
              archived || l.type === 'opening' || l.type === 'reversed'
                ? undefined
                : () => {
                    if (l.reversedById) {
                      toast.show('This entry was already reversed.', 'info');
                      return;
                    }
                    setEntry(l);
                    setSheet('reverse');
                  }
            }
          />
        ))}
      </Card>

      <RestockSheet
        visible={sheet === 'restock'}
        supplyId={supply.id}
        unit={supply.unit}
        onClose={() => setSheet(null)}
      />
      <UseSheet visible={sheet === 'use'} supplyId={supply.id} onClose={() => setSheet(null)} />
      <DisposeSheet
        visible={sheet === 'dispose'}
        supplyId={supply.id}
        mode={mode}
        setMode={setMode}
        onClose={() => setSheet(null)}
      />
      <ReverseSheet
        visible={sheet === 'reverse'}
        supplyId={supply.id}
        entry={entry}
        onAdjust={() => openDispose('adjust')}
        onClose={() => setSheet(null)}
      />

      {stats.physical > 0 ? (
        <BottomSheet
          visible={sheet === 'archive'}
          title="Can’t archive yet"
          onClose={() => setSheet(null)}
        >
          <Banner
            tone="warning"
            body={`${supply.name} still has ${formatQuantity(stats.physical, supply.unit)}. Use, dispose or adjust to 0 first.`}
          />
          <Button
            label="Dispose remaining"
            icon="trash"
            variant="secondary"
            block
            onPress={() => openDispose('dispose')}
          />
          <Button label="Close" variant="ghost" block onPress={() => setSheet(null)} />
        </BottomSheet>
      ) : (
        <BottomSheet
          visible={sheet === 'archive'}
          title={`Archive ${supply.name}?`}
          onClose={() => setSheet(null)}
        >
          <AppText variant="bodyM" color={palette.text.secondary}>
            Physical stock is 0. Archiving hides it from Supplies and cancels its alerts; its
            history stays.
          </AppText>
          <Button
            label="Archive item"
            icon="archive"
            variant="destructive"
            block
            onPress={() => {
              actions.archiveSupply(supply.id);
              setSheet(null);
              toast.show('Item archived');
            }}
          />
          <Button label="Cancel" variant="ghost" block onPress={() => setSheet(null)} />
        </BottomSheet>
      )}
    </StackScreen>
  );
}

function RestockSheet({
  visible,
  supplyId,
  unit,
  onClose,
}: {
  visible: boolean;
  supplyId: string;
  unit: string;
  onClose: () => void;
}) {
  const { today, actions } = useStore();
  const toast = useToast();
  const [qty, setQty] = useState('');
  const [label, setLabel] = useState('');
  const [expiresOn, setExpiresOn] = useState<string | undefined>();
  const [picker, setPicker] = useState(false);
  const parsed = qty ? parseQuantity(qty, unit) : {};
  const expired = Boolean(expiresOn && expiresOn < today);
  const amount = parsed.value ? formatQuantity(parsed.value, unit) : '';
  const close = () => {
    setQty('');
    setLabel('');
    setExpiresOn(undefined);
    onClose();
  };
  return (
    <BottomSheet visible={visible} title="Restock" onClose={close}>
      <Field
        label="Quantity"
        value={qty}
        onChangeText={setQty}
        placeholder="0"
        suffix={unitLabel(unit, parsed.value ?? 2)}
        keyboardType="decimal-pad"
        error={qty ? parsed.error : undefined}
      />
      <FieldRow>
        <Field
          label="Batch (optional)"
          value={label}
          onChangeText={setLabel}
          placeholder="Lot number"
          autoCapitalize="characters"
          style={half}
        />
        <Field
          label="Expires on (optional)"
          value={expiresOn ? formatDate(expiresOn) : ''}
          placeholder="Date"
          trailingIcon="calendar"
          onPress={() => setPicker(true)}
          style={half}
        />
      </FieldRow>
      {expired ? (
        <Banner
          tone="warning"
          title="This batch is already expired"
          body="It will be recorded as expired stock, not usable."
        />
      ) : (
        <AppText variant="caption" color={palette.text.secondary}>
          No expiry on the pack? Leave it blank and it shows as Unknown expiry.
        </AppText>
      )}
      <Button
        label={
          parsed.value ? (expired ? `Add ${amount} as expired` : `Add ${amount}`) : 'Add to stock'
        }
        block
        disabled={!parsed.value}
        onPress={() => {
          if (!parsed.value) return;
          actions.restock(supplyId, parsed.value, label, expiresOn);
          toast.show(`${amount} added`);
          close();
        }}
      />
      <DateSheet
        visible={picker}
        title="Expires on"
        value={expiresOn}
        onClose={() => setPicker(false)}
        onDone={(d) => {
          setExpiresOn(d);
          setPicker(false);
        }}
      />
    </BottomSheet>
  );
}

function UseSheet({
  visible,
  supplyId,
  onClose,
}: {
  visible: boolean;
  supplyId: string;
  onClose: () => void;
}) {
  const { state, today, actions } = useStore();
  const toast = useToast();
  const supply = state.supplies.find((s) => s.id === supplyId);
  const order = supply ? consumptionOrder(supply.batches, today) : [];
  const [batchId, setBatchId] = useState<string | undefined>();
  const [count, setCount] = useState(1);
  const [typed, setTyped] = useState('');
  const [petId, setPetId] = useState<string | undefined>(supply?.petIds[0]);
  if (!supply) return null;
  const discrete = isDiscreteUnit(supply.unit);
  const batch = order.find((b) => b.id === batchId) ?? order[0];
  const parsed = discrete ? { value: count } : typed ? parseQuantity(typed, supply.unit) : {};
  const usable = round(order.reduce((n, b) => n + b.quantity, 0));
  const tooMuch = Boolean(parsed.value && batch && parsed.value > batch.quantity);
  const pets = state.pets.filter((p) => supply.petIds.includes(p.id) && !p.archivedOn);
  const pet = pets.find((p) => p.id === petId);
  const rx = state.prescriptions.find(
    (r) => r.supplyId === supply.id && r.petId === petId && !r.stoppedOn,
  );

  return (
    <BottomSheet visible={visible} title="Record use" onClose={onClose}>
      {tooMuch ? (
        <Banner
          tone="danger"
          title="Not enough usable stock"
          body={`Only ${formatQuantity(batch?.quantity ?? 0, supply.unit)} ${order.length > 1 ? 'are in this batch' : 'are usable now'}. Lower the quantity or restock first.`}
        />
      ) : null}
      {discrete ? (
        <View style={styles.qtyRow}>
          <AppText variant="label" style={styles.grow}>
            Quantity
          </AppText>
          <Stepper
            value={count}
            onChange={setCount}
            unit={unitLabel(supply.unit, count)}
            min={1}
            max={9999}
            label="Quantity"
          />
        </View>
      ) : (
        <Field
          label="Quantity"
          value={typed}
          onChangeText={setTyped}
          placeholder="0"
          suffix={supply.unit}
          keyboardType="decimal-pad"
          error={typed ? parsed.error : undefined}
        />
      )}
      <FieldGroup
        label="From batch"
        helper={`${formatQuantity(usable, supply.unit)} usable in total. Earliest expiry is used first.`}
      >
        {order.map((b: Batch) => (
          <SelectRow
            key={b.id}
            title={`Batch ${b.label}`}
            subtitle={`${formatQuantity(b.quantity, supply.unit)} usable · ${b.expiresOn ? `expires ${formatDate(b.expiresOn)}` : 'unknown expiry'}`}
            selected={b.id === batch?.id}
            onPress={() => setBatchId(b.id)}
          />
        ))}
      </FieldGroup>
      {pets.length ? (
        <FieldGroup label="For">
          <WrapRow>
            {pets.map((p) => (
              <PetPill
                key={p.id}
                name={p.name}
                avatar={p.avatar}
                selected={p.id === petId}
                onPress={() => setPetId(p.id === petId ? undefined : p.id)}
              />
            ))}
          </WrapRow>
        </FieldGroup>
      ) : null}
      {rx ? (
        <Field
          label="Prescription (optional)"
          value={rx.medication}
          leadingIcon="link"
          disabled
          onPress={() => undefined}
        />
      ) : null}
      <Button
        label="Record use"
        block
        disabled={!parsed.value || !batch || tooMuch}
        onPress={() => {
          if (!parsed.value || !batch) return;
          actions.consume(
            supply.id,
            batch.id,
            parsed.value,
            [pet?.name, rx?.medication].filter(Boolean).join(' · ') || 'Household',
          );
          toast.show(`${formatQuantity(parsed.value, supply.unit)} recorded as used`);
          setCount(1);
          setTyped('');
          onClose();
        }}
      />
    </BottomSheet>
  );
}

function DisposeSheet({
  visible,
  supplyId,
  mode,
  setMode,
  onClose,
}: {
  visible: boolean;
  supplyId: string;
  mode: 'dispose' | 'adjust';
  setMode: (m: 'dispose' | 'adjust') => void;
  onClose: () => void;
}) {
  const { state, today, actions } = useStore();
  const toast = useToast();
  const supply = state.supplies.find((s) => s.id === supplyId);
  const [batchId, setBatchId] = useState<string | undefined>();
  const [count, setCount] = useState(1);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  if (!supply) return null;
  const discrete = isDiscreteUnit(supply.unit);
  const candidates = supply.batches.filter((b) => mode === 'adjust' || b.quantity > 0);
  const defaultBatch =
    mode === 'dispose'
      ? (candidates.find((b) => b.expiresOn && b.expiresOn < today) ?? candidates[0])
      : (consumptionOrder(supply.batches, today)[0] ?? candidates[0]);
  const batch = candidates.find((b) => b.id === batchId) ?? defaultBatch;
  const amount = discrete ? count : Number(typed.replace(',', '.')) || 0;
  const typedError =
    !discrete && typed ? parseQuantity(typed.replace('-', ''), supply.unit).error : undefined;
  const belowZero = Boolean(
    batch && (mode === 'dispose' ? amount > batch.quantity : batch.quantity + amount < 0),
  );
  const valid = Boolean(
    batch &&
    amount !== 0 &&
    !belowZero &&
    !typedError &&
    reason.trim() &&
    (mode === 'adjust' || amount > 0),
  );
  const st = batch ? batchState(batch, supply.expiryLeadDays, today) : undefined;

  const reset = () => {
    setBatchId(undefined);
    setCount(1);
    setTyped('');
    setReason('');
  };

  return (
    <BottomSheet
      visible={visible}
      title="Dispose or adjust"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <SegmentedControl
        segments={[
          { value: 'dispose', label: 'Dispose' },
          { value: 'adjust', label: 'Adjust' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setCount(1);
        }}
        accessibilityLabel="Dispose or adjust"
      />
      {belowZero && batch ? (
        <Banner
          tone="danger"
          body={`Batch ${batch.label} has only ${formatQuantity(batch.quantity, supply.unit)}. Balances can’t go below zero.`}
        />
      ) : null}
      {candidates.length > 1 ? (
        <WrapRow>
          {candidates.map((b) => (
            <SelectRowCompact
              key={b.id}
              label={b.label}
              selected={b.id === batch?.id}
              onPress={() => setBatchId(b.id)}
            />
          ))}
        </WrapRow>
      ) : null}
      {batch ? (
        <FieldGroup label="Batch quantities">
          <View style={styles.batchCard}>
            <View style={styles.grow}>
              <AppText variant="titleS">Batch {batch.label}</AppText>
              <AppText variant="caption" color={palette.text.secondary}>
                {formatQuantity(batch.quantity, supply.unit)} ·{' '}
                {batch.expiresOn
                  ? `${st === 'expired' ? 'expired' : 'expires'} ${formatDate(batch.expiresOn)}`
                  : 'unknown expiry'}
              </AppText>
            </View>
            {discrete ? (
              <Stepper
                value={count}
                onChange={setCount}
                unit={unitLabel(supply.unit, count)}
                min={mode === 'adjust' ? -Math.floor(batch.quantity) : 1}
                signed={mode === 'adjust'}
                label={mode === 'adjust' ? 'Adjustment' : 'Quantity to dispose'}
              />
            ) : (
              <Field
                label={mode === 'adjust' ? 'Change (±)' : 'Quantity'}
                value={typed}
                onChangeText={setTyped}
                placeholder="0"
                suffix={supply.unit}
                keyboardType="numbers-and-punctuation"
                error={typedError}
                style={styles.narrow}
              />
            )}
          </View>
        </FieldGroup>
      ) : null}
      <Textarea
        label="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder={
          mode === 'dispose' ? 'e.g. Expired on 31 Oct' : 'e.g. Found an extra pack in the drawer'
        }
        maxLength={200}
      />
      <Button
        label={
          mode === 'dispose'
            ? `Dispose ${formatQuantity(Math.abs(amount), supply.unit)}`
            : 'Save adjustment'
        }
        variant={mode === 'dispose' ? 'destructive' : 'primary'}
        block
        disabled={!valid}
        onPress={() => {
          if (!batch) return;
          if (mode === 'dispose') actions.dispose(supply.id, batch.id, amount, reason.trim());
          else actions.adjust(supply.id, batch.id, amount, reason.trim());
          toast.show(
            mode === 'dispose'
              ? `${formatQuantity(amount, supply.unit)} disposed`
              : 'Adjustment saved',
          );
          reset();
          onClose();
        }}
      />
    </BottomSheet>
  );
}

function SelectRowCompact({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <SelectRow title={`Batch ${label}`} selected={selected} onPress={onPress} />;
}

function ReverseSheet({
  visible,
  supplyId,
  entry,
  onAdjust,
  onClose,
}: {
  visible: boolean;
  supplyId: string;
  entry: LedgerEntry | null;
  onAdjust: () => void;
  onClose: () => void;
}) {
  const { state, actions } = useStore();
  const toast = useToast();
  const supply = state.supplies.find((s) => s.id === supplyId);
  if (!supply || !entry) return null;
  const batch = supply.batches.find((b) => b.id === entry.batchId);
  const blocked = !batch || batch.quantity - entry.quantity < 0;
  const row = (
    <Card padded="ledger">
      <LedgerRow
        type={entry.type}
        detail={`${formatWhen(entry.date, entry.time)} · ${entry.detail}`}
        quantity={formatSignedQuantity(entry.quantity, supply.unit)}
      />
    </Card>
  );
  if (blocked) {
    return (
      <BottomSheet visible={visible} title="Can’t reverse this entry" onClose={onClose}>
        {row}
        <Banner
          tone="warning"
          body={`Reversing would take batch ${batch?.label ?? ''} below zero (${formatQuantity(batch?.quantity ?? 0, supply.unit)} left). Record an adjustment instead.`}
        />
        <Button
          label="Adjust instead"
          icon="sliders"
          variant="secondary"
          block
          onPress={onAdjust}
        />
        <Button label="Close" variant="ghost" block onPress={onClose} />
      </BottomSheet>
    );
  }
  const abs = formatQuantity(Math.abs(entry.quantity), supply.unit);
  return (
    <BottomSheet visible={visible} title="Reverse this entry?" onClose={onClose}>
      {row}
      <AppText variant="bodyM" color={palette.text.secondary}>
        {entry.quantity < 0 ? `Adds ${abs} back to` : `Removes ${abs} from`} batch {batch?.label} as
        a new “Reversed” entry. The original stays in the ledger.
      </AppText>
      <Button
        label="Reverse entry"
        icon="rotate-ccw"
        block
        onPress={() => {
          actions.reverse(supply.id, entry.id);
          toast.show('Entry reversed');
          onClose();
        }}
      />
      <Button label="Cancel" variant="ghost" block onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: 2 },
  stats: { flexDirection: 'row', gap: space[2] + 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  narrow: { width: 150 },
  batchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[3] + 2,
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
  },
});
