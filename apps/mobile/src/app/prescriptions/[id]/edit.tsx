import { useLocalSearchParams } from 'expo-router';
import { NotFound } from '@/components/not-found';
import { PrescriptionForm } from '@/components/prescription-form';
import { useStore } from '@/lib/store';

export default function EditPrescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  // Stopped prescriptions are history (VC-03).
  const rx = state.prescriptions.find((r) => r.id === id && !r.stoppedOn);
  if (!rx) return <NotFound title="Prescription" />;
  return <PrescriptionForm prescription={rx} />;
}
