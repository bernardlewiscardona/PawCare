import { router } from 'expo-router';
import { useState } from 'react';
import { ForPet } from '@/components/for-pet';
import { DateSheet, SelectSheet, TimeSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { Banner, useToast } from '@/components/ui/feedback';
import { Field, FieldGroup, Textarea } from '@/components/ui/field';
import { ModalHeader } from '@/components/ui/header';
import { Chip } from '@/components/ui/pill';
import { FieldRow, StackScreen, WrapRow, half } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { formatDate, formatTime12h } from '@/lib/format';
import { zoneLabel } from '@/lib/profile';
import { useSelectedPet, useStore } from '@/lib/store';
import type { Prescription, ScheduleMode } from '@/lib/types';
import { color as palette } from '@/theme/tokens';

const MODES = [
  { value: 'fixed', label: 'Fixed daily' },
  { value: 'asNeeded', label: 'As needed' },
  { value: 'manual', label: 'Manual' },
] as const;

type Errors = Partial<
  Record<'medication' | 'instructions' | 'startDate' | 'endDate' | 'times', string>
>;

/**
 * Figma: 40 Vaccines & Meds / Prescription form (Empty, Filled, Error, Success, Add dose time,
 * Edit). VC-02: transcribed, never calculated; only fixed daily times are scheduled.
 */
export function PrescriptionForm({ prescription }: { prescription?: Prescription }) {
  const { state, actions } = useStore();
  const { pet } = useSelectedPet();
  const toast = useToast();
  const zone = prescription?.timeZone ?? state.owner.timeZone;
  const [petId, setPetId] = useState(prescription?.petId ?? pet?.id);
  const [medication, setMedication] = useState(prescription?.medication ?? '');
  const [instructions, setInstructions] = useState(prescription?.instructions ?? '');
  const [prescriber, setPrescriber] = useState(prescription?.prescriber ?? '');
  const [startDate, setStartDate] = useState(prescription?.startDate);
  const [endDate, setEndDate] = useState(prescription?.endDate);
  const [mode, setMode] = useState<ScheduleMode>(prescription?.mode ?? 'fixed');
  const [times, setTimes] = useState<string[]>(prescription?.times ?? []);
  const [supplyId, setSupplyId] = useState(prescription?.supplyId);
  const [sheet, setSheet] = useState<'start' | 'end' | 'time' | 'supply' | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const supplies = state.supplies.filter(
    (s) => !s.archivedOn && (s.category === 'Medication' || s.category === 'Supplement'),
  );
  const supply = supplies.find((s) => s.id === supplyId);
  const dirty =
    !prescription && Boolean(medication || instructions || prescriber || startDate || times.length);

  const reset = (nextPet: string) => {
    setPetId(nextPet);
    setMedication('');
    setInstructions('');
    setPrescriber('');
    setStartDate(undefined);
    setEndDate(undefined);
    setTimes([]);
    setSupplyId(undefined);
    setErrors({});
  };

  const save = () => {
    const next: Errors = {};
    if (!medication.trim() || medication.trim().length > 150)
      next.medication = 'Enter the medication name and strength.';
    if (!instructions.trim()) next.instructions = 'Add the dose instructions from your vet.';
    if (!startDate) next.startDate = 'Pick a start date.';
    if (startDate && endDate && endDate < startDate)
      next.endDate = 'Must be on or after the start date.';
    if (mode === 'fixed' && times.length === 0)
      next.times = 'Add at least one time for a fixed daily schedule.';
    setErrors(next);
    if (Object.keys(next).length || !petId || !startDate) return;
    const data = {
      petId,
      medication: medication.trim(),
      instructions: instructions.trim(),
      prescriber: prescriber.trim() || undefined,
      startDate,
      endDate,
      mode,
      times: mode === 'fixed' ? [...times].sort() : [],
      timeZone: zone,
      supplyId,
    };
    const message = mode === 'fixed' ? 'Prescription saved · reminders set' : 'Prescription saved';
    if (prescription) {
      actions.updatePrescription(prescription.id, data);
      toast.show(message);
      router.back();
    } else {
      const id = actions.addPrescription(data);
      toast.show(message);
      router.replace(`/prescriptions/${id}`);
    }
  };

  return (
    <StackScreen
      layout="form"
      header={
        <ModalHeader title={prescription ? 'Edit prescription' : 'Prescription'} onAction={save} />
      }
    >
      {prescription ? (
        <Banner
          tone="info"
          body="Changing times or dates replaces upcoming doses and reminders. Doses you’ve logged stay."
        />
      ) : null}
      <ForPet
        petId={petId}
        onChange={reset}
        dirty={dirty}
        recordLabel="prescription"
        locked={Boolean(prescription)}
      />
      <Field
        label="Medication"
        value={medication}
        onChangeText={setMedication}
        placeholder="Name and strength"
        leadingIcon="pill"
        maxLength={150}
        error={errors.medication}
      />
      <Textarea
        label="Dose instructions"
        value={instructions}
        onChangeText={setInstructions}
        placeholder="e.g. 1 tablet twice daily with food"
        maxLength={2000}
        error={errors.instructions}
      />
      <Field
        label="Prescriber (optional)"
        value={prescriber}
        onChangeText={setPrescriber}
        placeholder="Vet’s name"
        leadingIcon="stethoscope"
        maxLength={150}
      />
      <FieldRow>
        <Field
          label="Starts on"
          value={startDate ? formatDate(startDate) : ''}
          placeholder="Date"
          trailingIcon="calendar"
          onPress={() => setSheet('start')}
          error={errors.startDate}
          style={half}
        />
        <Field
          label="Ends on (optional)"
          value={endDate ? formatDate(endDate) : ''}
          placeholder="Date"
          trailingIcon="calendar"
          onPress={() => setSheet('end')}
          error={errors.endDate}
          style={half}
        />
      </FieldRow>
      <FieldGroup label="Schedule">
        <SegmentedControl
          segments={MODES}
          value={mode}
          onChange={setMode}
          accessibilityLabel="Schedule"
        />
      </FieldGroup>
      {mode === 'fixed' ? (
        <FieldGroup label="Dose times" error={errors.times} helper={`In ${zoneLabel(zone)}`}>
          <WrapRow>
            {[...times].sort().map((t) => (
              <Chip
                key={t}
                label={formatTime12h(t)}
                icon="clock"
                accessibilityHint="Removes this time"
                onPress={() => setTimes((list) => list.filter((x) => x !== t))}
              />
            ))}
            <Chip label="Add time" icon="plus" onPress={() => setSheet('time')} />
          </WrapRow>
        </FieldGroup>
      ) : (
        <AppText variant="caption" color={palette.text.secondary}>
          {mode === 'asNeeded'
            ? 'As-needed prescriptions don’t schedule dose reminders.'
            : 'Manual schedules (tapers, alternate days) aren’t turned into daily doses. Add custom reminders if you need them.'}
        </AppText>
      )}
      <Field
        label="Linked supply (optional)"
        value={supply?.name ?? ''}
        placeholder={supplies.length ? 'Choose a household item' : 'No medication supplies yet'}
        leadingIcon="link"
        trailingIcon="chevron-down"
        disabled={!supplies.length}
        onPress={() => setSheet('supply')}
      />

      <DateSheet
        visible={sheet === 'start' || sheet === 'end'}
        title={sheet === 'start' ? 'Starts on' : 'Ends on'}
        value={sheet === 'start' ? startDate : endDate}
        minDate={sheet === 'end' ? startDate : undefined}
        onClose={() => setSheet(null)}
        onDone={(d) => {
          if (sheet === 'start') setStartDate(d);
          else setEndDate(d);
          setSheet(null);
        }}
      />
      <TimeSheet
        visible={sheet === 'time'}
        title="Add a dose time"
        value="08:00"
        buttonLabel="Add time"
        caption={`Each time can be used once per prescription. Daily doses repeat at this time in ${zone}.`}
        onClose={() => setSheet(null)}
        onDone={(t) => {
          if (times.includes(t)) toast.show(`${formatTime12h(t)} is already a dose time.`, 'error');
          else setTimes((list) => [...list, t]);
          setSheet(null);
        }}
      />
      <SelectSheet
        visible={sheet === 'supply'}
        title="Linked supply"
        options={supplies.map((s) => ({ value: s.id, label: s.name, subtitle: s.category }))}
        value={supplyId}
        onSelect={setSupplyId}
        onClose={() => setSheet(null)}
      />
    </StackScreen>
  );
}
