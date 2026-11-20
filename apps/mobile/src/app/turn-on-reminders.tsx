import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { IconTile } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

/**
 * Figma: 10 Auth & Onboarding / Turn on reminders. RM-01: opting in shows the OS prompt; denial
 * keeps in-app reminders. TODO(push): request permission once push notifications ship.
 */
export default function TurnOnRemindersScreen() {
  const { actions } = useStore();
  const finish = (push: boolean) => {
    actions.updatePrefs({ push });
    router.replace('/home');
  };
  return (
    <StackScreen
      header={null}
      centered
      gap={space[4]}
      bottomBar={
        <>
          <Button label="Turn on notifications" icon="bell" block onPress={() => finish(true)} />
          <Button label="Not now" variant="ghost" block onPress={() => finish(false)} />
        </>
      }
    >
      <IconTile illustration="bell" size="large" tone="yellow" />
      <AppText variant="titleL" align="center" accessibilityRole="header">
        Never miss a dose or a due vaccine
      </AppText>
      <AppText variant="bodyM" color={palette.text.secondary} align="center">
        Get a push notification when something needs you. Everything also stays in your Inbox.
      </AppText>
      <View style={styles.list}>
        <ListItem
          title="Medication doses"
          subtitle="At the times you set"
          illustration="pill-bottle"
        />
        <ListItem
          title="Vaccines and visits"
          subtitle="Ahead of the due date or visit"
          illustration="syringe"
        />
        <ListItem
          title="Supplies"
          subtitle="When stock runs low or expires"
          illustration="food-bag"
        />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({ list: { alignSelf: 'stretch', gap: space[4] } });
