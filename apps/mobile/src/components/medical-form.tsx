import { router } from 'expo-router';
import { useState } from 'react';
import { useDiscardGuard } from '@/components/discard-guard';
import { DateSheet, SelectSheet } from '@/components/sheets';
import { ForPet } from '@/components/for-pet';
import { Banner, useToast } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { ModalHeader } from '@/components/ui/header';
import { FieldRow, StackScreen, half } from '@/components/ui/screen';
import { FileUploader } from '@/components/ui/uploaders';
import { formatDate, formatDayMonthShort } from '@/lib/format';
import { useSelectedPet, useStore } from '@/lib/store';
import { MEDICAL_TYPES, type MedicalRecord, type MedicalType } from '@/lib/types';

type Errors = Partial<Record<'type' | 'date' | 'title', string>>;

/** Figma: 30 Health Diary / Medical form (Empty, Filled, Error, Success, Edit). MR-01 / MR-04. */
export function MedicalForm({
  record,
  linkedVisitId,
}: {
  record?: MedicalRecord;
  linkedVisitId?: string;
}) {
  const { state, today, actions } = useStore();
  const { pet } = useSelectedPet();
  const toast = useToast();
  const linked = state.visits.find((v) => v.id === linkedVisitId);
  const [petId, setPetId] = useState(record?.petId ?? linked?.petId ?? pet?.id);
  const [type, setType] = useState<MedicalType | undefined>(
    record?.type ?? (linked ? 'Visit' : undefined),
  );
  const [date, setDate] = useState(record?.date ?? linked?.date);
  const [title, setTitle] = useState(record?.title ?? '');
  const [provider, setProvider] = useState(record?.provider ?? linked?.provider ?? '');
  const [visitId, setVisitId] = useState(record?.linkedVisitId ?? linked?.id);
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [sheet, setSheet] = useState<'type' | 'date' | 'visit' | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const dirty = !record && Boolean(type || date || title || provider || notes);
  const guard = useDiscardGuard({ type, date, title, provider, visitId, notes }, 'medical record');
  const visits = state.visits.filter((v) => v.petId === petId && v.status === 'completed');
  const visit = visits.find((v) => v.id === visitId);

  const reset = (nextPet: string) => {
    setPetId(nextPet);
    setType(undefined);
    setDate(undefined);
    setTitle('');
    setProvider('');
    setVisitId(undefined);
    setNotes('');
    setErrors({});
  };

  const save = () => {
    const next: Errors = {};
    if (!type) next.type = 'Choose an event type.';
    if (!date) next.date = 'Pick the date it happened.';
    else if (date > today) next.date = 'Planned visits go in Visits. Pick a date that has passed.';
    if (!title.trim() || title.trim().length > 150)
      next.title = 'Add a short title so you can find this later.';
    setErrors(next);
    if (Object.keys(next).length || !petId || !type || !date) return;
    const data = {
      petId,
      type,
      date,
      title: title.trim(),
      provider: provider.trim() || undefined,
      linkedVisitId: visitId,
      notes: notes.trim() || undefined,
    };
    if (record) {
      actions.updateMedical(record.id, data);
      toast.show('Medical record saved');
      guard.leave(() => router.back());
    } else {
      const id = actions.addMedical(data);
      toast.show('Medical record saved');
      guard.leave(() => router.replace(`/records/${id}`));
    }
  };

  return (
    <StackScreen
      layout="form"
      header={
        <ModalHeader title={record ? 'Edit medical record' : 'Medical record'} onAction={save} />
      }
    >
      {record ? (
        <Banner
          tone="neutral"
          body={`Entered by you · last edited ${formatDate(record.editedOn)}. Files stay attached when you save.`}
        />
      ) : null}
      <ForPet
        petId={petId}
        onChange={reset}
        dirty={dirty}
        recordLabel="medical record"
        locked={Boolean(record)}
      />
      <FieldRow>
        <Field
          label="Event type"
          value={type ?? ''}
          placeholder="Choose"
          trailingIcon="chevron-down"
          onPress={() => setSheet('type')}
          error={errors.type}
          style={half}
        />
        <Field
          label="Date"
          value={date ? formatDate(date) : ''}
          placeholder="Pick a date"
          trailingIcon="calendar"
          onPress={() => setSheet('date')}
          error={errors.date}
          style={half}
        />
      </FieldRow>
      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Skin allergy flare-up"
        maxLength={150}
        error={errors.title}
      />
      <Field
        label="Provider (optional)"
        value={provider}
        onChangeText={setProvider}
        placeholder="Clinic or vet name"
        leadingIcon="stethoscope"
        maxLength={150}
      />
      <Field
        label="Linked visit (optional)"
        value={visit ? `${visit.title} · ${formatDayMonthShort(visit.date)}` : ''}
        placeholder={visits.length ? 'Choose a completed visit' : 'No completed visits yet'}
        leadingIcon="link"
        trailingIcon="chevron-down"
        disabled={!visits.length}
        onPress={() => setSheet('visit')}
      />
      <Textarea
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Symptoms, what the vet said, next steps"
        maxLength={5000}
      />
      {!record ? (
        <FileUploader
          count={0}
          onPress={() => toast.show('File upload arrives with file storage.', 'info')}
        />
      ) : null}

      <SelectSheet
        visible={sheet === 'type'}
        title="Event type"
        options={MEDICAL_TYPES.map((t) => ({ value: t, label: t }))}
        value={type}
        onSelect={setType}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet === 'visit'}
        title="Linked visit"
        options={visits.map((v) => ({
          value: v.id,
          label: v.title,
          subtitle: `${formatDate(v.date)} · ${v.provider}`,
        }))}
        value={visitId}
        onSelect={setVisitId}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'date'}
        title="Date"
        value={date}
        maxDate={today}
        caption="Medical records are history. Log planned visits in Visits."
        onClose={() => setSheet(null)}
        onDone={(d) => {
          setDate(d);
          setSheet(null);
        }}
      />
      {guard.dialog}
    </StackScreen>
  );
}
