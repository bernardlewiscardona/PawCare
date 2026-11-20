import { useLocalSearchParams } from 'expo-router';
import { NotFound } from '@/components/not-found';
import { ReminderForm } from '@/components/reminder-form';
import { useStore } from '@/lib/store';

export default function EditReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const reminder = state.customReminders.find((r) => r.id === id);
  if (!reminder) return <NotFound title="Reminder" />;
  return <ReminderForm reminder={reminder} />;
}
