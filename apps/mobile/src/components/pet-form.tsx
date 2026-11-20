import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DateSheet } from '@/components/sheets';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useToast } from '@/components/ui/feedback';
import { ModalHeader } from '@/components/ui/header';
import { FieldRow, StackScreen, half } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Toggle } from '@/components/ui/toggle';
import { ImageUploader } from '@/components/ui/uploaders';
import { formatDate } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { Pet, Sex, Species } from '@/lib/types';
import { space } from '@/theme/tokens';

const SPECIES = [
  { value: 'Dog', label: 'Dog' },
  { value: 'Cat', label: 'Cat' },
  { value: 'Other', label: 'Other' },
] as const;
const SEXES = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Unknown', label: 'Unknown' },
] as const;

type Errors = Partial<
  Record<'name' | 'otherSpecies' | 'birthDate' | 'weight' | 'microchip', string>
>;

/** Figma: 20 Home & Pets / Pet form (Empty, Filled, Error, Success). PF-02 / PF-03. */
export function PetForm({ pet, onboarding = false }: { pet?: Pet; onboarding?: boolean }) {
  const { today, actions } = useStore();
  const toast = useToast();
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'Dog');
  const [otherSpecies, setOtherSpecies] = useState(pet?.otherSpecies ?? '');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [sex, setSex] = useState<Sex>(pet?.sex ?? 'Unknown');
  const [birthDate, setBirthDate] = useState(pet?.birthDate);
  const [estimated, setEstimated] = useState(pet?.birthEstimated ?? false);
  const [weight, setWeight] = useState(pet?.weightKg ? String(pet.weightKg) : '');
  const [measuredOn, setMeasuredOn] = useState(pet?.weightMeasuredOn);
  const [microchip, setMicrochip] = useState(pet?.microchip ?? '');
  const [picker, setPicker] = useState<'birth' | 'measured' | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const save = () => {
    const next: Errors = {};
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) next.name = 'Enter a name of 1–100 characters.';
    if (species === 'Other' && !otherSpecies.trim())
      next.otherSpecies = 'Tell us what kind of pet this is.';
    if (birthDate && birthDate > today) next.birthDate = 'Birth date can’t be in the future.';
    const kg = weight.trim() ? Number(weight.replace(',', '.')) : undefined;
    if (kg !== undefined && (!Number.isFinite(kg) || kg <= 0 || kg > 1000))
      next.weight = 'Enter a weight above 0 kg.';
    const chip = microchip.replace(/\s/g, '');
    if (chip && !/^\d{15}$/.test(chip)) next.microchip = 'Microchips have 15 digits.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const data = {
      name: trimmed,
      species,
      otherSpecies: species === 'Other' ? otherSpecies.trim() : undefined,
      breed: breed.trim() || undefined,
      sex,
      birthDate,
      birthEstimated: estimated,
      weightKg: kg,
      weightMeasuredOn: kg !== undefined ? (measuredOn ?? today) : undefined,
      microchip: microchip.trim() || undefined,
      avatar: pet?.avatar,
    };
    if (pet) {
      actions.updatePet(pet.id, data);
      toast.show(`${trimmed}’s profile saved`);
      router.back();
      return;
    }
    const id = actions.addPet(data);
    toast.show(`${trimmed}’s profile saved`);
    if (onboarding) router.replace('/turn-on-reminders');
    else router.replace(`/pets/${id}`);
  };

  return (
    <StackScreen
      layout="form"
      gap={space[2] + 2}
      header={
        <ModalHeader
          title={pet ? 'Edit pet' : 'Add pet'}
          onAction={save}
          actionDisabled={!name.trim()}
        />
      }
    >
      <View style={styles.nameRow}>
        <ImageUploader
          avatar={pet?.avatar}
          size={78}
          label={pet ? `Change ${pet.name}’s photo` : 'Add a photo'}
          onPress={() => toast.show('Photo upload arrives with file storage.', 'info')}
        />
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Mochi"
          maxLength={100}
          error={errors.name}
          style={half}
        />
      </View>
      <FieldGroup label="Species">
        <SegmentedControl
          segments={SPECIES}
          value={species}
          onChange={setSpecies}
          accessibilityLabel="Species"
        />
      </FieldGroup>
      {species === 'Other' ? (
        <Field
          label="Other species"
          value={otherSpecies}
          onChangeText={setOtherSpecies}
          placeholder="e.g. Rabbit"
          error={errors.otherSpecies}
        />
      ) : null}
      <Field
        label="Breed (optional)"
        value={breed}
        onChangeText={setBreed}
        placeholder="e.g. Aspin, Puspin, Shih Tzu"
      />
      <FieldGroup label="Sex">
        <SegmentedControl segments={SEXES} value={sex} onChange={setSex} accessibilityLabel="Sex" />
      </FieldGroup>
      <View style={styles.birthRow}>
        <Field
          label="Birth date"
          value={
            birthDate
              ? estimated
                ? `${birthDate.slice(0, 4)} (estimated)`
                : formatDate(birthDate)
              : ''
          }
          placeholder="Pick a date"
          trailingIcon="calendar"
          onPress={() => setPicker('birth')}
          error={errors.birthDate}
          style={half}
        />
        <View style={styles.estimated}>
          <FieldLabel>Estimated</FieldLabel>
          <Toggle
            value={estimated}
            onValueChange={setEstimated}
            accessibilityLabel="Birth date is estimated"
          />
        </View>
      </View>
      <FieldRow>
        <Field
          label="Weight"
          value={weight}
          onChangeText={setWeight}
          placeholder="0.0"
          suffix="kg"
          keyboardType="decimal-pad"
          error={errors.weight}
          style={half}
        />
        <Field
          label="Measured on"
          value={measuredOn ? formatDate(measuredOn) : ''}
          placeholder="Date"
          trailingIcon="calendar"
          onPress={() => setPicker('measured')}
          style={half}
        />
      </FieldRow>
      <Field
        label="Microchip (optional)"
        value={microchip}
        onChangeText={setMicrochip}
        placeholder="15-digit number"
        keyboardType="number-pad"
        error={errors.microchip}
      />

      <DateSheet
        visible={picker !== null}
        title={picker === 'birth' ? 'Birth date' : 'Weight measured on'}
        value={picker === 'birth' ? birthDate : measuredOn}
        maxDate={today}
        onClose={() => setPicker(null)}
        onDone={(d) => {
          if (picker === 'birth') setBirthDate(d);
          else setMeasuredOn(d);
          setPicker(null);
        }}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] + 2 },
  birthRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3] },
  estimated: { gap: space[2], paddingBottom: space[3], alignItems: 'center' },
});
