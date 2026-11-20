import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SelectSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useToast } from '@/components/ui/feedback';
import { DetailHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';
import { ImageUploader } from '@/components/ui/uploaders';
import { phoneError, TIME_ZONES, zoneLabel } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

/** Figma: 10 Auth & Onboarding / Profile setup (Empty, Filled, Error). PF-01. */
export default function ProfileSetupScreen() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(state.owner.phone ?? '');
  const [zone, setZone] = useState(state.owner.timeZone);
  const [zonePicker, setZonePicker] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const submit = () => {
    const next: typeof errors = {};
    if (!name.trim() || name.trim().length > 100)
      next.name = 'Enter the name you want PawCare to use.';
    const pe = phoneError(phone);
    if (pe) next.phone = pe;
    setErrors(next);
    if (Object.keys(next).length) return;
    actions.updateOwner({
      displayName: name.trim(),
      phone: phone.trim() || undefined,
      timeZone: zone,
    });
    toast.show('Profile saved');
    router.replace('/first-pet');
  };

  return (
    <StackScreen
      header={<DetailHeader title="Your profile" />}
      gap={space[4]}
      bottomBar={
        <Button label="Save and continue" block disabled={!name.trim()} onPress={submit} />
      }
    >
      <AppText variant="titleL" accessibilityRole="header" style={styles.title}>
        Tell us about you
      </AppText>
      <AppText variant="bodyM" color={palette.text.secondary}>
        This is how PawCare greets you and times your reminders.
      </AppText>
      <View style={styles.center}>
        <ImageUploader
          avatar={name.trim() ? state.owner.avatar : undefined}
          label="Add a profile photo"
          onPress={() => toast.show('Photo upload arrives with file storage.', 'info')}
        />
      </View>
      <Field
        label="Display name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Bea"
        maxLength={100}
        error={errors.name}
      />
      <Field
        label="Mobile number (optional)"
        value={phone}
        onChangeText={setPhone}
        prefix="+63"
        placeholder="917 123 4567"
        keyboardType="phone-pad"
        error={errors.phone}
      />
      <Field
        label="Time zone"
        value={zoneLabel(zone)}
        leadingIcon="globe"
        trailingIcon="chevron-down"
        helper="Reminders and due dates use this time zone."
        onPress={() => setZonePicker(true)}
      />
      <SelectSheet
        visible={zonePicker}
        title="Time zone"
        options={TIME_ZONES.map((z) => ({ value: z, label: zoneLabel(z) }))}
        value={zone}
        onSelect={setZone}
        onClose={() => setZonePicker(false)}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space[2] },
  center: { alignItems: 'center' },
});
