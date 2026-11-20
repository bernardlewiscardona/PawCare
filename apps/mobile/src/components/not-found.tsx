import { router } from 'expo-router';
import { EmptyState } from '@/components/ui/feedback';
import { DetailHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';

/**
 * Generic unavailable state for missing or inaccessible objects. It reveals nothing about the
 * object (shared requirement 1) and offers a way back.
 */
export function NotFound({ title = 'Not available' }: { title?: string }) {
  return (
    <StackScreen header={<DetailHeader title={title} />} centered>
      <EmptyState
        illustration="paw"
        title="This isn’t available"
        body="It may have been removed or changed on another device."
        actionLabel="Go home"
        actionIcon="house"
        onAction={() => router.replace('/home')}
      />
    </StackScreen>
  );
}
