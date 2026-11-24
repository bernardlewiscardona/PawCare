import {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  useFonts,
} from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedSplash } from '@/components/animated-splash';
import { DataGate } from '@/components/data-gate';
import { ToastProvider } from '@/components/ui/feedback';
import { screenTransition, useReducedMotion } from '@/lib/motion';
import { DataProvider, useDataState } from '@/data';
import { ignoreRepeatedPush } from '@/lib/navigation';
import { DemoStoreProvider } from '@/lib/store';
import { color as palette } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

function AppShell() {
  // Keys must match `fontFamily` in theme/tokens.ts.
  const [fontsLoaded, fontError] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
  });
  const reduceMotion = useReducedMotion();
  const { top: topInset } = useSafeAreaInsets();
  const { state } = useDataState();

  // Fall back to the system font rather than blocking the app if Lexend fails to load.
  if (!fontsLoaded && !fontError) return null;

  return (
    <DemoStoreProvider>
      <ToastProvider>
        {/* Screens cross-fade over this, never over the (theme-dependent) window background. */}
        <View style={styles.backdrop}>
          <DataGate>
            <Stack
              // A double tap pushes the same screen twice; the second push is ignored.
              UNSTABLE_router={ignoreRepeatedPush}
              screenOptions={({ route }) => ({
                headerShown: false,
                contentStyle: { backgroundColor: palette.bg.screen },
                // Every screen change in one place; see `screenTransition` in lib/motion.ts.
                ...screenTransition(route.name, { reduceMotion, topInset }),
              })}
            />
          </DataGate>
        </View>
        <StatusBar style="dark" />
        {/* Over everything: takes over from the native splash, then reveals the first screen. */}
        <AnimatedSplash hold={state === 'opening'} />
      </ToastProvider>
    </DemoStoreProvider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: palette.bg.screen },
});
