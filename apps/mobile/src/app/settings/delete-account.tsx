import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppText } from '@/components/ui/app-text';
import { IconTile } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { DetailCard } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

/**
 * Figma: 80 Settings & Account / Delete account (Review, Confirm, Error, In progress). FN-02 is
 * the only permanent deletion; it needs re-authentication. TODO(FN-02): call the deletion API.
 */
export default function DeleteAccountScreen() {
  const { state, actions } = useStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!deleting) return;
    const t = setTimeout(() => {
      actions.deleteAccount();
      router.dismissAll();
      router.replace('/');
    }, 2500);
    return () => clearTimeout(t);
  }, [deleting, actions]);

  if (deleting) {
    return (
      <StackScreen header={null} centered gap={space[4]}>
        <IconTile illustration="paw" size="large" tone="surface" />
        <Spinner size={28} />
        <AppText variant="titleL" align="center" accessibilityRole="header">
          Deleting your account
        </AppText>
        <AppText
          variant="bodyM"
          color={palette.text.secondary}
          align="center"
          accessibilityLiveRegion="polite"
        >
          You’ve been signed out on every device. Your pets, records, files, supplies and reminders
          are being removed. You can close PawCare.
        </AppText>
      </StackScreen>
    );
  }

  const archived = state.pets.filter((p) => p.archivedOn).length;
  const records =
    state.medical.length + state.vaccines.length + state.prescriptions.length + state.visits.length;
  const files =
    state.medical.reduce((n, r) => n + r.attachments.length, 0) +
    state.vaccines.reduce((n, v) => n + v.attachments.length, 0);

  return (
    <StackScreen
      header={<DetailHeader title="Delete account" />}
      bottomBar={
        <>
          <Button
            label="Delete my account"
            variant="destructive"
            block
            disabled={!password}
            onPress={() => {
              // Demo rule for re-authentication: any 8+ character password.
              if (password.length < 8)
                setError('That password is incorrect. Your account is still active.');
              else setDeleting(true);
            }}
          />
          <Button label="Keep my account" variant="ghost" block onPress={() => router.back()} />
        </>
      }
    >
      <Banner
        tone="danger"
        title="This can’t be undone"
        body="Deleting removes everything in your account. Download any files you want to keep first."
      />
      <DetailCard
        rows={[
          ['Pets', `${state.pets.length}${archived ? ` (${archived} archived)` : ''}`],
          ['Health records', String(records)],
          ['Files', String(files)],
          ['Supplies', `${state.supplies.length} items`],
          ['Custom reminders', String(state.customReminders.length)],
        ]}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(undefined);
        }}
        placeholder="Enter your password"
        secure
        helper="We need it to confirm it’s you."
        error={error}
      />
    </StackScreen>
  );
}
