import { useLocalSearchParams } from 'expo-router';
import { NotFound } from '@/components/not-found';
import { VisitForm } from '@/components/visit-form';
import { useStore } from '@/lib/store';

export default function EditVisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  // Completed, canceled and missed entries are read-only in v1 (AP-03).
  const visit = state.visits.find((v) => v.id === id && v.status === 'planned');
  if (!visit) return <NotFound title="Visit" />;
  return <VisitForm visit={visit} />;
}
