import { useLocalSearchParams } from 'expo-router';
import { PetForm } from '@/components/pet-form';

export default function NewPetScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  return <PetForm onboarding={onboarding === '1'} />;
}
