import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DevDataStatus } from '@/components/dev-data-status';
import { DevConnectivityCheck } from '@/components/dev-connectivity-check';
import { AppText } from '@/components/ui/app-text';
import { color as palette, space } from '@/theme/tokens';

/** Development-only tools (long-press the logo on Welcome). Not reachable in release builds. */
export default function DevScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <AppText variant="titleL" accessibilityRole="header">
          Developer tools
        </AppText>
        <DevConnectivityCheck />
        <DevDataStatus />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg.screen },
  content: { flex: 1, gap: space[4], padding: space[5] },
});
