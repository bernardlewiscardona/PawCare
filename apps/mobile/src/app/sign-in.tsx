import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

/**
 * Figma: 10 Auth & Onboarding / Sign in (Empty, Filled, Error, Loading).
 * Authentication is a prerequisite outside this backlog; this screen signs into the demo
 * household. TODO(auth): call the auth provider once its ticket lands.
 */
export default function SignInScreen() {
  const { state, actions } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = () => {
    setFailed(false);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Demo rule: the sample owner's email with any 8+ character password.
      if (email.trim().toLowerCase() !== state.owner.email || password.length < 8) {
        setFailed(true);
        return;
      }
      actions.signIn();
      // Home replaces the whole auth stack (and fades in), so Back can't return to sign-in.
      router.dismissAll();
      router.replace('/home');
    }, 700);
  };

  return (
    <StackScreen
      header={<DetailHeader title="Sign in" />}
      gap={space[4]}
      bottomBar={
        <>
          <Button
            label="Sign in"
            block
            loading={loading}
            disabled={!email || !password}
            onPress={submit}
          />
          <Button
            label="Create an account"
            variant="ghost"
            block
            onPress={() => router.replace('/register')}
          />
        </>
      }
    >
      <AppText variant="titleL" accessibilityRole="header" style={styles.title}>
        Welcome back
      </AppText>
      <AppText variant="bodyM" color={palette.text.secondary}>
        Sign in to see Mochi and Kape’s care.
      </AppText>
      {failed ? (
        <Banner tone="danger" body="Email or password is incorrect. Check both and try again." />
      ) : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        leadingIcon="mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        disabled={loading}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        leadingIcon="lock"
        secure
        autoComplete="current-password"
        disabled={loading}
        error={failed ? 'Passwords are case-sensitive.' : undefined}
      />
      <Button label="Forgot password?" variant="ghost" size="small" style={styles.forgot} />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space[2] },
  forgot: { alignSelf: 'flex-start' },
});
