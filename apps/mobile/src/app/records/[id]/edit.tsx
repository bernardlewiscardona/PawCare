import { useLocalSearchParams } from 'expo-router';
import { MedicalForm } from '@/components/medical-form';
import { NotFound } from '@/components/not-found';
import { useStore } from '@/lib/store';

export default function EditMedicalRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  // Voided records are read-only (MR-04).
  const record = state.medical.find((r) => r.id === id && !r.voidedOn);
  if (!record) return <NotFound title="Medical record" />;
  return <MedicalForm record={record} />;
}
