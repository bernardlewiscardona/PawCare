import { router } from 'expo-router';
import { useState } from 'react';
import { useDiscardGuard } from '@/components/discard-guard';
import { ForPet } from '@/components/for-pet';
import { DateSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { Banner, useToast } from '@/components/ui/feedback';
import { Field, FieldGroup } from '@/components/ui/field';
import { ModalHeader } from '@/components/ui/header';
import { Chip } from '@/components/ui/pill';
import { FieldRow, StackScreen, WrapRow, half } from '@/components/ui/screen';
import { openVaccineDues } from '@/lib/derive';
import { formatDate, formatDayMonthShort } from '@/lib/format';
import { useSelectedPet, useStore } from '@/lib/store';
import type { Vaccine } from '@/lib/types';
import { color as palette } from '@/theme/tokens';

const shortName = (name: string) => name.replace(/\s*\(.*?\)\s*/g, ' ').trim();

type Errors = Partial<Record<'name' | 'givenOn' | 'nextDueOn', string>>;

/** Figma: 40 Vaccines & Meds / Vaccine form (Empty, Filled, Error, Success, Edit). VC-01 / VC-04. */
export function VaccineForm({ vaccine }: { vaccine?: Vaccine }) {
  const { state, today, actions } = useStore();
  const { pet } = useSelectedPet();
  const toast = useToast();
  const [petId, setPetId] = useState(vaccine?.petId ?? pet?.id);
  const [name, setName] = useState(vaccine?.name ?? '');
  const [givenOn, setGivenOn] = useState(vaccine?.givenOn);
  const [batch, setBatch] = useState(vaccine?.batch ?? '');
  const [provider, setProvider] = useState(vaccine?.provider ?? '');
  const [nextDueOn, setNextDueOn] = useState(vaccine?.nextDueOn);
  const [fulfils, setFulfils] = useState<string[]>(vaccine?.fulfils ?? []);
  const [picker, setPicker] = useState<'given' | 'next' | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const dues = openVaccineDues(
    state.vaccines.map((v) => (vaccine && v.id === vaccine.id ? { ...v, fulfils: [] } : v)),
    petId,
  ).filter((v) => v.id !== vaccine?.id);
  const options = [...dues, ...state.vaccines.filter((v) => vaccine?.fulfils.includes(v.id))];
  const dirty = !vaccine && Boolean(name || givenOn || batch || provider || nextDueOn);
  const guard = useDiscardGuard({ name, givenOn, batch, provider, nextDueOn, fulfils }, 'vaccine');

  const reset = (nextPet: string) => {
    setPetId(nextPet);
    setName('');
    setGivenOn(undefined);
    setBatch('');
    setProvider('');
    setNextDueOn(undefined);
    setFulfils([]);
    setErrors({});
  };

  const save = () => {
    const next: Errors = {};
    if (!name.trim() || name.trim().length > 150) next.name = 'Enter the vaccine name.';
    if (!givenOn) next.givenOn = 'Pick the date it was given.';
    else if (givenOn > today) next.givenOn = 'The date given can’t be in the future.';
    if (nextDueOn && givenOn && nextDueOn < givenOn)
      next.nextDueOn = 'Next due date can’t be before the date given.';
    setErrors(next);
    if (Object.keys(next).length || !petId || !givenOn) return;
    const data = {
      petId,
      name: name.trim(),
      givenOn,
      batch: batch.trim() || undefined,
      provider: provider.trim() || undefined,
      nextDueOn,
      fulfils,
    };
    const closed = state.vaccines.filter((v) => fulfils.includes(v.id));
    const message =
      closed.length === 1 && closed[0].nextDueOn
        ? `Vaccine saved · ${formatDayMonthShort(closed[0].nextDueOn)} ${shortName(closed[0].name).split(' ').pop()} fulfilled`
        : closed.length > 1
          ? `Vaccine saved · ${closed.length} due items fulfilled`
          : 'Vaccine saved';
    if (vaccine) {
      actions.updateVaccine(vaccine.id, data);
      toast.show(message);
      guard.leave(() => router.back());
    } else {
      const id = actions.addVaccine(data);
      toast.show(message);
      guard.leave(() => router.replace(`/vaccines/${id}`));
    }
  };

  return (
    <StackScreen
      layout="form"
      header={<ModalHeader title={vaccine ? 'Edit vaccine' : 'Vaccine'} onAction={save} />}
    >
      {vaccine ? (
        <Banner
          tone="info"
          body="Changing the next due date moves its reminder. Fulfilment changes update the due items you pick."
        />
      ) : null}
      <ForPet
        petId={petId}
        onChange={reset}
        dirty={dirty}
        recordLabel="vaccine"
        locked={Boolean(vaccine)}
      />
      <Field
        label="Vaccine name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Anti-rabies"
        leadingIcon="syringe"
        maxLength={150}
        error={errors.name}
      />
      <FieldRow>
        <Field
          label="Given on"
          value={givenOn ? formatDate(givenOn) : ''}
          placeholder="Pick a date"
          trailingIcon="calendar"
          onPress={() => setPicker('given')}
          error={errors.givenOn}
          style={half}
        />
        <Field
          label="Batch (optional)"
          value={batch}
          onChangeText={setBatch}
          placeholder="Lot number"
          autoCapitalize="characters"
          style={half}
        />
      </FieldRow>
      <Field
        label="Provider (optional)"
        value={provider}
        onChangeText={setProvider}
        placeholder="Clinic or vet name"
        leadingIcon="stethoscope"
        maxLength={150}
      />
      <Field
        label="Next due on (optional)"
        value={nextDueOn ? formatDate(nextDueOn) : ''}
        placeholder="Pick a date"
        trailingIcon="calendar"
        helper="We’ll remind you before it’s due."
        onPress={() => setPicker('next')}
        error={errors.nextDueOn}
      />
      {options.length ? (
        <FieldGroup label="Does this shot fulfil a due vaccine?">
          <WrapRow>
            {options.map((v) => {
              const due = v.nextDueOn as string;
              const label = `${shortName(v.name)} · ${due < today ? 'was due' : 'due'} ${formatDayMonthShort(due)}`;
              const selected = fulfils.includes(v.id);
              return (
                <Chip
                  key={v.id}
                  label={label}
                  multi
                  selected={selected}
                  onPress={() =>
                    setFulfils((f) => (selected ? f.filter((x) => x !== v.id) : [...f, v.id]))
                  }
                />
              );
            })}
          </WrapRow>
        </FieldGroup>
      ) : null}
      {options.length ? (
        <AppText variant="caption" color={palette.text.secondary}>
          Select each one this shot covers. PawCare never matches by name.
        </AppText>
      ) : null}

      <DateSheet
        visible={picker !== null}
        title={picker === 'given' ? 'Given on' : 'Next due on'}
        value={picker === 'given' ? givenOn : nextDueOn}
        maxDate={picker === 'given' ? today : undefined}
        minDate={picker === 'next' ? givenOn : undefined}
        onClose={() => setPicker(null)}
        onDone={(d) => {
          if (picker === 'given') setGivenOn(d);
          else setNextDueOn(d);
          setPicker(null);
        }}
      />
      {guard.dialog}
    </StackScreen>
  );
}
