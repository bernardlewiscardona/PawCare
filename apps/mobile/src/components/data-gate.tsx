import { useEffect, useRef, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDataState, type OpenResult } from '@/data';
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
  useEffect(() => {
    busy.current = false;
  }, [data.state]);

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

  const copy = COPY[data.state];
  const act = (run: () => Promise<OpenResult>) => {
    if (busy.current) return;
    busy.current = true;
    data.replace(run());
  };
  const confirmStartFresh = (startFresh: () => Promise<OpenResult>) => {
    if (busy.current) return;
    Alert.alert(
      'Start fresh?',
      'PawCare will start empty. Your current data is set aside, not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start fresh', style: 'destructive', onPress: () => act(startFresh) },
      ],
    );
  };

  return (
    <View style={styles.message}>
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
          <Button
            label="Start fresh"
            variant="secondary"
            onPress={() => confirmStartFresh(data.startFresh)}
          />
        </ButtonStack>
      ) : null}
    </View>
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
  message: {
    flex: 1,
    justifyContent: 'center',
    gap: space[4],
    padding: space[5],
    backgroundColor: palette.bg.screen,
  },
  banner: { position: 'absolute', left: space[4], right: space[4] },
});
