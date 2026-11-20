import { useLocalSearchParams } from 'expo-router';
import { MedicalForm } from '@/components/medical-form';

export default function NewMedicalRecordScreen() {
  const { visit } = useLocalSearchParams<{ visit?: string }>();
  return <MedicalForm linkedVisitId={visit} />;
}
