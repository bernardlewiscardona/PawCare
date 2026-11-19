import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DevConnectivityCheck } from '@/components/dev-connectivity-check';

/** Placeholder home screen until the first feature tickets land. */
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          PawCare
        </Text>
        <Text style={styles.subtitle}>Your pet diary is on its way.</Text>
        {__DEV__ ? <DevConnectivityCheck /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#24292f' },
  subtitle: { fontSize: 16, color: '#57606a', textAlign: 'center' },
});
