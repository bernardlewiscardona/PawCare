import { router } from 'expo-router';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/feedback';
import { DetailHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';
import { ToggleRow } from '@/components/ui/toggle';
import { scheduleLabel } from '@/lib/reminders';
import { useStore } from '@/lib/store';
import { color as palette, space } from '@/theme/tokens';

/** Figma: 70 Reminders / Scheduled (Default, Empty). RM-03. */
export default function CustomRemindersScreen() {
  const { state, actions } = useStore();
  const reminders = state.customReminders;
  return (
    <StackScreen
      gap={space[2] + 2}
      header={
        <DetailHeader
          title="Custom reminders"
          action={{
            icon: 'plus',
            label: 'New reminder',
            onPress: () => router.push('/reminders/new'),
          }}
        />
      }
    >
      {reminders.length === 0 ? (
        <EmptyState
          illustration="bell"
          title="No custom reminders"
          body="Add one for walks, grooming or anything PawCare doesn’t track for you."
          actionLabel="New reminder"
          onAction={() => router.push('/reminders/new')}
        />
      ) : (
        <>
          {reminders.map((r) => (
            <ToggleRow
              key={r.id}
              title={r.title}
              helper={scheduleLabel(r, state.pets.find((p) => p.id === r.petId)?.name)}
              value={r.enabled}
              onValueChange={(enabled) => actions.updateCustomReminder(r.id, { enabled })}
              onPress={() => router.push(`/reminders/${r.id}`)}
            />
          ))}
          <AppText variant="caption" color={palette.text.secondary}>
            Turning one off keeps it here without sending reminders.
          </AppText>
        </>
      )}
    </StackScreen>
  );
}
