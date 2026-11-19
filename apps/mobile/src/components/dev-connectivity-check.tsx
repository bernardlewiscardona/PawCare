import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl } from '@/lib/config';
import { checkApiConnectivity, type ConnectivityResult } from '@/lib/connectivity';

const MESSAGES: Record<ConnectivityResult['state'], { title: string; hint: string }> = {
  ready: { title: 'Connected: API and database are up', hint: '' },
  'database-down': {
    title: 'API reachable, database down',
    hint: 'Start PostgreSQL with "pnpm db:up", then retry.',
  },
  unreachable: {
    title: 'Cannot reach the API',
    hint: 'Run "pnpm dev:api". On a phone, use the same Wi-Fi and allow port 3000 in your firewall, or set EXPO_PUBLIC_API_URL.',
  },
  'not-configured': {
    title: 'API URL not configured',
    hint: 'Set EXPO_PUBLIC_API_URL in apps/mobile/.env.',
  },
};

/** Development-only panel. Status is conveyed in text, not just color. */
export function DevConnectivityCheck() {
  const [result, setResult] = useState<ConnectivityResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void checkApiConnectivity(apiBaseUrl).then((next) => {
      if (active) setResult(next);
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setResult(null);
    setAttempt((n) => n + 1);
  };

  const message = result ? MESSAGES[result.state] : null;

  return (
    <View style={styles.panel} accessibilityRole="summary">
      <Text style={styles.label}>Development connectivity check</Text>
      <Text style={styles.url} selectable>
        {apiBaseUrl ?? 'No API URL'}
      </Text>
      {message ? (
        <View accessibilityLiveRegion="polite">
          <Text style={[styles.title, result?.state === 'ready' ? styles.ok : styles.problem]}>
            {result?.state === 'ready' ? '✓ ' : '✕ '}
            {message.title}
          </Text>
          {message.hint ? <Text style={styles.hint}>{message.hint}</Text> : null}
        </View>
      ) : (
        <ActivityIndicator accessibilityLabel="Checking API connection" />
      )}
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Retry connectivity check"
        style={styles.button}
      >
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d7de',
    alignSelf: 'stretch',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#57606a' },
  url: { fontSize: 13, color: '#57606a' },
  title: { fontSize: 16, fontWeight: '600' },
  ok: { color: '#1a7f37' },
  problem: { color: '#cf222e' },
  hint: { fontSize: 14, color: '#24292f' },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#24292f',
  },
  buttonText: { color: '#ffffff', fontWeight: '600' },
});
