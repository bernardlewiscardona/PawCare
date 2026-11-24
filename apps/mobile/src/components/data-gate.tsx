import { useEffect, useRef, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDataState, type DataState, type OpenResult } from '@/data';
import { AppText } from '@/components/ui/app-text';
import { Button, ButtonStack } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { color as palette, space } from '@/theme/tokens';

const COPY = {
  'encryption-unavailable': {
    title: "Can't protect your data on this build",
    body: "This version of PawCare can't encrypt your data, so it won't open it. Install the latest version.",
  },
  'too-new': {
    title: 'Update PawCare',
    body: 'Your data was saved by a newer version of PawCare. Update the app to open it.',
  },
  'key-missing': {
    title: "Your data can't be opened on this phone",
    body: 'Start fresh to keep using PawCare. Your old data is set aside, not deleted.',
  },
  failed: {
    title: 'Something went wrong opening your data',
    body: 'Try again. If it keeps happening, you can start fresh. Your old data is set aside, not deleted.',
  },
  /** `failed` when only Try again can be offered. */
  'failed-retry-only': {
    title: 'Something went wrong opening your data',
    body: 'Try again. If it keeps happening, close PawCare and open it again.',
  },
} as const;

/**
 * Lets the app through only when the database is open. Every other state is a plain screen with
 * what the person can do about it. An unencrypted development database shows a banner on top.
 */
export function DataGate({ children }: { children: ReactNode }) {
  const data = useDataState();
  const { top } = useSafeAreaInsets();
  // Blocks a second tap before the state has switched to `opening`.
  const busy = useRef(false);
  // The state on screen now, so a Start fresh alert can tell if it has gone stale.
  const shown = useRef<DataState>(data);
  useEffect(() => {
    busy.current = false;
    shown.current = data;
  }, [data]);

  if (data.state === 'ready') {
    return (
      <View style={styles.fill}>
        {children}
        {!data.encrypted ? (
          <View pointerEvents="none" style={[styles.banner, { top: top + space[2] }]}>
            <Banner
              tone="warning"
              title="Development data, not encrypted"
              body="This build is for development only."
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (data.state === 'opening') {
    return (
      <View style={styles.center}>
        <View accessible accessibilityLabel="Opening your data" accessibilityRole="progressbar">
          <Spinner size={32} />
        </View>
      </View>
    );
  }

  const copy =
    data.state === 'failed' && !data.startFresh ? COPY['failed-retry-only'] : COPY[data.state];
  // `replace` calls `run` only if nothing else is in flight.
  const act = (run: () => Promise<OpenResult>) => {
    if (busy.current) return;
    busy.current = true;
    data.replace(run);
  };
  const confirmStartFresh = (startFresh: () => Promise<OpenResult>) => {
    if (busy.current) return;
    // A double tap can stack two alerts, and an alert can outlive its screen. Confirming acts
    // only while the screen still shows the OpenResult the alert was raised from: each one has
    // its own `startFresh`, so comparing it compares the result.
    const stillShown = () => {
      const now = shown.current;
      return (
        (now.state === 'key-missing' || now.state === 'failed') && now.startFresh === startFresh
      );
    };
    Alert.alert(
      'Start fresh?',
      'PawCare will start empty. Your current data is set aside, not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: () => {
            if (stillShown()) act(startFresh);
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.message}>
      <AppText variant="titleL" accessibilityRole="header">
        {copy.title}
      </AppText>
      <AppText variant="bodyM" color={palette.text.secondary}>
        {copy.body}
      </AppText>
      {data.state === 'key-missing' ? (
        <ButtonStack>
          <Button label="Start fresh" onPress={() => confirmStartFresh(data.startFresh)} />
        </ButtonStack>
      ) : null}
      {data.state === 'failed' ? (
        <ButtonStack>
          <Button label="Try again" onPress={() => act(data.retry)} />
          {data.startFresh ? (
            <Button
              label="Start fresh"
              variant="secondary"
              onPress={() => confirmStartFresh(data.startFresh)}
            />
          ) : null}
        </ButtonStack>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg.screen,
  },
  screen: { flex: 1, backgroundColor: palette.bg.screen },
  // Scrolls, so large text never pushes the buttons off-screen.
  message: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: space[4],
    padding: space[5],
  },
  banner: { position: 'absolute', left: space[4], right: space[4] },
});
