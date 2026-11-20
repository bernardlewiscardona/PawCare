import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/app-text';
import { IconTile } from '@/components/ui/badges';
import { Button, ButtonStack } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { color as palette, space } from '@/theme/tokens';

/** Figma: 10 Auth & Onboarding / Welcome — default. */
export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Pressable
          onLongPress={__DEV__ ? () => router.push('/dev') : undefined}
          accessible={false}
          style={styles.logo}
        >
          <Logo size={72} />
        </Pressable>
        <AppText variant="display" accessibilityRole="header">
          PawCare
        </AppText>
        <AppText variant="bodyL" color={palette.text.secondary} align="center" style={styles.lede}>
          Health records, vaccines, medication, visits and supplies for every pet you own.
        </AppText>
        <View style={styles.tiles}>
          <IconTile illustration="syringe" size="large" tone="blue" />
          <IconTile illustration="calendar" size="large" tone="pink" />
          <IconTile illustration="pill-bottle" size="large" tone="green" />
          <IconTile illustration="food-bag" size="large" tone="yellow" />
        </View>
      </View>

      <View style={styles.footer}>
        <ButtonStack>
          <Button label="Create account" block onPress={() => router.push('/register')} />
          <Button
            label="I already have an account"
            variant="secondary"
            block
            onPress={() => router.push('/sign-in')}
          />
        </ButtonStack>
        <AppText variant="caption" color={palette.text.secondary} align="center">
          PawCare needs an internet connection.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg.canvas },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[5],
  },
  logo: { marginBottom: space[1] },
  lede: { maxWidth: 340 },
  tiles: { flexDirection: 'row', gap: space[3], marginTop: space[1] },
  footer: { gap: space[2], paddingHorizontal: space[5], paddingBottom: space[1] },
});
