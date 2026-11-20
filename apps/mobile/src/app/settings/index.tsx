import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SelectSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { useToast } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { ModalHeader } from '@/components/ui/header';
import { Dialog } from '@/components/ui/overlay';
import { ListItem } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { ImageUploader } from '@/components/ui/uploaders';
import { phoneError, TIME_ZONES, zoneCity, zoneLabel } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

/**
 * Figma: 80 Settings & Account / Settings & profile (Default, Error, Time zone change). PF-01;
 * a zone change previews its effect on reminders before applying (RM-01).
 */
export default function SettingsScreen() {
  const { state, actions } = useStore();
  const toast = useToast();
  const { owner, prefs } = state;
  const [name, setName] = useState(owner.displayName);
  const [phone, setPhone] = useState(owner.phone ?? '');
  const [zone, setZone] = useState(owner.timeZone);
  const [picker, setPicker] = useState(false);
  const [pendingZone, setPendingZone] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const save = () => {
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
    router.back();
  };

  return (
    <StackScreen gap={space[3] + 2} header={<ModalHeader title="Settings" onAction={save} />}>
      <View style={styles.who}>
        <ImageUploader
          avatar={owner.avatar}
          size={64}
          label="Change profile photo"
          onPress={() => toast.show('Photo upload arrives with file storage.', 'info')}
        />
        <View style={styles.grow}>
          <AppText variant="titleM">{owner.displayName}</AppText>
          <AppText variant="caption" color={palette.text.secondary}>
            {owner.email}
          </AppText>
        </View>
      </View>
      <Field
        label="Display name"
        value={name}
        onChangeText={setName}
        maxLength={100}
        error={errors.name}
      />
      <Field
        label="Mobile number"
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
        onPress={() => setPicker(true)}
      />
      <SectionHeader title="Account" />
      <ListItem
        title="Notifications"
        subtitle={`Push ${prefs.push ? 'on' : 'off'} · visits ${prefs.visitLeadHours} h, vaccines ${prefs.vaccineLeadDays} ${prefs.vaccineLeadDays === 1 ? 'day' : 'days'} before`}
        icon="bell"
        onPress={() => router.push('/settings/notifications')}
      />
      <ListItem
        title="Sign out"
        icon="log-out"
        chevron={false}
        onPress={() => {
          actions.signOut();
          router.dismissAll();
          router.replace('/');
        }}
      />
      <ListItem
        title="Delete account"
        subtitle="Permanently remove your data"
        icon="trash"
        onPress={() => router.push('/settings/delete-account')}
      />

      <SelectSheet
        visible={picker}
        title="Time zone"
        options={TIME_ZONES.map((z) => ({ value: z, label: zoneLabel(z) }))}
        value={zone}
        onSelect={(z) => {
          if (z !== zone) setPendingZone(z);
        }}
        onClose={() => setPicker(false)}
      />
      <Dialog
        visible={pendingZone !== null}
        illustration="calendar"
        title={`Switch to ${pendingZone ?? ''}?`}
        body={`Vaccine and supply reminders will use ${zoneCity(pendingZone ?? '')} time from now on. Visit times and each prescription’s dose times stay as they are.`}
        cancelLabel={`Keep ${zoneCity(zone)}`}
        confirmLabel="Switch"
        onCancel={() => setPendingZone(null)}
        onConfirm={() => {
          if (pendingZone) setZone(pendingZone);
          setPendingZone(null);
        }}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space[3] + 2 },
  grow: { flex: 1, gap: 2 },
});
