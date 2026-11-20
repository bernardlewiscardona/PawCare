import {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  useFonts,
} from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ToastProvider } from '@/components/ui/feedback';
import { DemoStoreProvider } from '@/lib/store';
import { color as palette } from '@/theme/tokens';

export default function RootLayout() {
  // Keys must match `fontFamily` in theme/tokens.ts.
  const [fontsLoaded, fontError] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
  });

  // Fall back to the system font rather than blocking the app if Lexend fails to load.
  if (!fontsLoaded && !fontError) return null;

  return (
    <DemoStoreProvider>
      <ToastProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.bg.screen },
          }}
        />
        <StatusBar style="dark" />
      </ToastProvider>
    </DemoStoreProvider>
  );
}
