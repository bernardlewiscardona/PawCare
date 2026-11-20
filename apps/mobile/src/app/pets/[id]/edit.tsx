import { useLocalSearchParams } from 'expo-router';
import { PetForm } from '@/components/pet-form';
import { NotFound } from '@/components/not-found';
import { useStore } from '@/lib/store';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const pet = state.pets.find((p) => p.id === id && !p.archivedOn);
  // Archived history is read-only until restored (PF-04).
  if (!pet) return <NotFound />;
  return <PetForm pet={pet} />;
}
