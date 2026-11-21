import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDiscardGuard } from '@/components/discard-guard';
import { DateSheet, TimeSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { Banner, useToast } from '@/components/ui/feedback';
import { Field, FieldGroup, Textarea } from '@/components/ui/field';
import { ModalHeader } from '@/components/ui/header';
import { Dialog } from '@/components/ui/overlay';
import { PetPill } from '@/components/ui/pill';
import { BleedRow, FieldRow, StackScreen, half } from '@/components/ui/screen';
import { isUpcomingVisit } from '@/lib/derive';
import { formatShortDate, formatShortDateYear, formatTime12h, formatTimeRange } from '@/lib/format';
import { zoneLabel } from '@/lib/profile';
import { useActivePets, useSelectedPet, useStore } from '@/lib/store';
import type { Visit } from '@/lib/types';
import { color as palette, space } from '@/theme/tokens';

/** AP-01 / AP-03: exact diary copy from the spec. */
export const DIARY_SAVED =
  'Saved to your diary. Arrange or confirm this visit directly with your clinic.';
export const DIARY_EDIT =
  'This updates your diary only. Contact your clinic to arrange the change.';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

type Errors = Partial<Record<'title' | 'provider' | 'date' | 'start' | 'end', string>>;

/**
 * Figma: 50 Appointments / Visit form (Empty, Filled, Error, Success, Edit, Date picker, Time
 * picker) and Overlap warning. A diary entry only — nothing is booked with the clinic.
 */
export function VisitForm({ visit }: { visit?: Visit }) {
  const { state, today, now, actions } = useStore();
  const pets = useActivePets();
  const { pet: selected } = useSelectedPet();
  const toast = useToast();
  const zone = visit?.timeZone ?? state.owner.timeZone;
  const [petId, setPetId] = useState(visit?.petId ?? selected?.id);
  const [title, setTitle] = useState(visit?.title ?? '');
  const [provider, setProvider] = useState(visit?.provider ?? '');
  const [date, setDate] = useState(visit?.date);
  const [start, setStart] = useState(visit?.start);
  const [end, setEnd] = useState(visit?.end);
  const [contact, setContact] = useState(visit?.contact ?? '');
  const [location, setLocation] = useState(visit?.location ?? '');
  const [notes, setNotes] = useState(visit?.notes ?? '');
  const [sheet, setSheet] = useState<'date' | 'start' | 'end' | null>(null);
  const [overlap, setOverlap] = useState<Visit | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const guard = useDiscardGuard(
    { title, provider, date, start, end, contact, location, notes },
    'visit',
  );

  const pet = state.pets.find((p) => p.id === petId);
  const others = state.visits.filter(
    (v) => v.petId === petId && v.id !== visit?.id && isUpcomingVisit(v, now),
  );
  const timeChanged = !visit || visit.date !== date || visit.start !== start || visit.end !== end;

  const commit = () => {
    if (!petId || !date || !start || !end) return;
    const data = {
      petId,
      title: title.trim(),
      provider: provider.trim(),
      date,
      start,
      end,
      timeZone: zone,
      contact: contact.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (visit) {
      actions.updateVisit(visit.id, data);
      toast.show('Visit updated in your diary');
      guard.leave(() => router.back());
    } else {
      const id = actions.addVisit(data);
      toast.show(DIARY_SAVED);
      guard.leave(() => router.replace(`/visits/${id}`));
    }
  };

  const save = () => {
    const next: Errors = {};
    if (!title.trim() || title.trim().length > 150)
      next.title = 'Add a title or reason for the visit.';
    if (!provider.trim() || provider.trim().length > 150)
      next.provider = 'Add the clinic, vet or groomer.';
    if (!date) next.date = 'Pick the visit date.';
    if (!start) next.start = 'Pick a start time.';
    if (!end) next.end = 'Pick an end time.';
    if (start && end) {
      const minutes = toMin(end) - toMin(start);
      if (minutes < 1 || minutes > 480) next.end = 'End 1 min to 8 h after start.';
    }
    if (date && start && timeChanged && `${date}T${start}` <= `${now.date}T${now.time}`) {
      next.date = 'New visit times must be in the future.';
    }
    setErrors(next);
    if (Object.keys(next).length || !date || !start || !end) return;
    // AP-01: same-pet overlap needs an explicit Continue; no clinic availability is implied.
    const clash = others.find(
      (v) => v.date === date && toMin(v.start) < toMin(end) && toMin(start) < toMin(v.end),
    );
    if (clash && timeChanged) {
      setOverlap(clash);
      return;
    }
    commit();
  };

  return (
    <StackScreen
      layout="form"
      header={<ModalHeader title={visit ? 'Edit visit' : 'Log a visit'} onAction={save} />}
    >
      {visit ? (
        <Banner tone="info" body={DIARY_EDIT} />
      ) : (
        <AppText variant="caption" color={palette.text.secondary}>
          Book with your clinic first. PawCare keeps the diary and reminds you.
        </AppText>
      )}
      <FieldGroup label="Pet" helper={visit ? 'Pet can’t change after saving' : undefined}>
        <BleedRow>
          {(visit ? pets.filter((p) => p.id === visit.petId) : pets).map((p) => (
            <PetPill
              key={p.id}
              name={p.name}
              avatar={p.avatar}
              selected={!visit && p.id === petId}
              disabled={Boolean(visit)}
              onPress={() => setPetId(p.id)}
            />
          ))}
        </BleedRow>
      </FieldGroup>
      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Annual check-up"
        maxLength={150}
        error={errors.title}
      />
      <Field
        label="Provider"
        value={provider}
        onChangeText={setProvider}
        placeholder="Clinic, vet or groomer"
        leadingIcon="stethoscope"
        maxLength={150}
        error={errors.provider}
      />
      <Field
        label="Date"
        value={date ? formatShortDateYear(date) : ''}
        placeholder="Pick a date"
        trailingIcon="calendar"
        helper={`Times are in ${zoneLabel(zone)}.`}
        onPress={() => setSheet('date')}
        error={errors.date}
      />
      <FieldRow>
        <Field
          label="Starts"
          value={start ? formatTime12h(start) : ''}
          placeholder="Time"
          trailingIcon="clock"
          onPress={() => setSheet('start')}
          error={errors.start}
          style={half}
        />
        <Field
          label="Ends"
          value={end ? formatTime12h(end) : ''}
          placeholder="Time"
          trailingIcon="clock"
          onPress={() => setSheet('end')}
          error={errors.end}
          style={half}
        />
      </FieldRow>
      <FieldRow>
        <Field
          label="Contact (optional)"
          value={contact}
          onChangeText={setContact}
          placeholder="Phone"
          leadingIcon="phone"
          keyboardType="phone-pad"
          maxLength={200}
          style={half}
        />
        <Field
          label="Location (optional)"
          value={location}
          onChangeText={setLocation}
          placeholder="Area"
          leadingIcon="map-pin"
          maxLength={500}
          style={half}
        />
      </FieldRow>
      <Textarea
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="What to bring or ask"
        maxLength={2000}
      />

      <DateSheet
        visible={sheet === 'date'}
        title="Visit date"
        value={date}
        minDate={visit && !timeChanged ? undefined : today}
        marked={others.map((v) => v.date)}
        caption={
          others.length
            ? `New visits must be in the future. The dot marks ${pet?.name}’s other planned ${others.length === 1 ? 'visit' : 'visits'}.`
            : 'New visits must be in the future.'
        }
        onClose={() => setSheet(null)}
        onDone={(d) => {
          setDate(d);
          setSheet(null);
        }}
      />
      <TimeSheet
        visible={sheet === 'start' || sheet === 'end'}
        title={sheet === 'start' ? 'Start time' : 'End time'}
        value={
          sheet === 'start'
            ? (start ?? '10:00')
            : (end ??
              (start
                ? `${String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, '0')}${start.slice(2)}`
                : '11:00'))
        }
        caption={`In ${zoneLabel(zone)}.`}
        onClose={() => setSheet(null)}
        onDone={(t) => {
          if (sheet === 'start') setStart(t);
          else setEnd(t);
          setSheet(null);
        }}
      />
      <Dialog
        visible={overlap !== null}
        illustration="calendar"
        title={`${pet?.name ?? 'Your pet'} already has a visit then`}
        body={
          overlap
            ? `${overlap.title} at ${overlap.provider}, ${formatShortDate(overlap.date)}, ${formatTimeRange(overlap.start, overlap.end)}, overlaps this one. Save both anyway?`
            : ''
        }
        cancelLabel="Change time"
        confirmLabel="Save anyway"
        onCancel={() => setOverlap(null)}
        onConfirm={() => {
          setOverlap(null);
          commit();
        }}
      />
      {guard.dialog}
      <View style={styles.spacer} />
    </StackScreen>
  );
}

const styles = StyleSheet.create({ spacer: { height: space[2] } });
