import { useLocalSearchParams } from 'expo-router';
import { NotFound } from '@/components/not-found';
import { VaccineForm } from '@/components/vaccine-form';
import { useStore } from '@/lib/store';

export default function EditVaccineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const vaccine = state.vaccines.find((v) => v.id === id && !v.voidedOn);
  if (!vaccine) return <NotFound title="Vaccine" />;
  return <VaccineForm vaccine={vaccine} />;
}
