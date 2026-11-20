import { router } from 'expo-router';
import { EmptyState } from '@/components/ui/feedback';
import { StackScreen } from '@/components/ui/screen';

/** Figma: 10 Auth & Onboarding / First pet (Default, Success toast shown by Profile setup). */
export default function FirstPetScreen() {
  return (
    <StackScreen header={null} centered>
      <EmptyState
        illustration="paw"
        title="Add your first pet"
        body="Create a profile for each pet to keep their health diary, vaccines, medication and visits together."
        actionLabel="Add a pet"
        onAction={() => router.push({ pathname: '/pets/new', params: { onboarding: '1' } })}
      />
    </StackScreen>
  );
}
