import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { IconTile } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Figma: 10 Auth & Onboarding / Register (Empty, Filled, Error, Success). TODO(auth). */
export default function RegisterScreen() {
  const { state, actions } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [done, setDone] = useState(false);

  const submit = () => {
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = 'Enter an email address like you@example.com.';
    else if (email.trim().toLowerCase() === state.owner.email)
      next.email = 'This email already has an account. Sign in instead.';
    if (password.length < 8) next.password = 'Use 8 or more characters.';
    setErrors(next);
    if (Object.keys(next).length === 0) {
      actions.signIn();
      setDone(true);
    }
  };

  if (done) {
    return (
      <StackScreen header={null} centered gap={space[4]}>
        <IconTile illustration="paw" size="large" tone="green" />
        <AppText variant="titleL" align="center" accessibilityRole="header">
          Account created
        </AppText>
        <AppText variant="bodyM" color={palette.text.secondary} align="center">
          Next, tell us a little about you, then add your first pet.
        </AppText>
        <Button label="Continue" block onPress={() => router.replace('/profile-setup')} />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      header={<DetailHeader title="Create account" />}
      gap={space[4]}
      bottomBar={
        <Button label="Create account" block disabled={!email || !password} onPress={submit} />
      }
    >
      <AppText variant="titleL" accessibilityRole="header" style={styles.title}>
        Create your account
      </AppText>
      <AppText variant="bodyM" color={palette.text.secondary}>
        PawCare is for pet owners. Your records stay private to you.
      </AppText>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        leadingIcon="mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={errors.email}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        leadingIcon="lock"
        secure
        autoComplete="new-password"
        helper="Use 8 or more characters."
        error={errors.password}
      />
      <AppText variant="caption" color={palette.text.secondary}>
        By creating an account you agree to the Terms and Privacy Policy.
      </AppText>
    </StackScreen>
  );
}

const styles = StyleSheet.create({ title: { marginTop: space[2] } });
