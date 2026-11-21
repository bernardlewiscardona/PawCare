import { router } from 'expo-router';
import { useState } from 'react';
import { useDiscardGuard } from '@/components/discard-guard';
import { DateSheet, TimeSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/feedback';
import { Field, FieldGroup } from '@/components/ui/field';
import { ModalHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { PetPill } from '@/components/ui/pill';
import { BleedRow, FieldRow, StackScreen, half } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ToggleRow } from '@/components/ui/toggle';
import { formatDate, formatTime12h } from '@/lib/format';
import { zoneLabel } from '@/lib/profile';
import { useActivePets, useSelectedPet, useStore } from '@/lib/store';
import type { CustomReminder } from '@/lib/types';
import { color as palette, space } from '@/theme/tokens';

const REPEAT = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
] as const;

type Errors = Partial<Record<'title' | 'start' | 'time' | 'end', string>>;

/**
 * Figma: 70 Reminders / Custom reminder form (Empty, Filled, Error, Success) and Delete custom
 * reminder. RM-03: None or Daily only; changes affect future occurrences only.
 */
export function ReminderForm({ reminder }: { reminder?: CustomReminder }) {
  const { state, today, now, actions } = useStore();
  const pets = useActivePets();
  const { pet } = useSelectedPet();
  const toast = useToast();
  const [petId, setPetId] = useState(reminder?.petId ?? pet?.id);
  const [title, setTitle] = useState(reminder?.title ?? '');
  const [startDate, setStartDate] = useState(reminder?.startDate);
  const [time, setTime] = useState(reminder?.time);
  const [repeat, setRepeat] = useState<'once' | 'daily'>(reminder?.repeat ?? 'once');
  const [endDate, setEndDate] = useState(reminder?.endDate);
  const [enabled, setEnabled] = useState(reminder?.enabled ?? true);
  const [sheet, setSheet] = useState<'start' | 'time' | 'end' | 'delete' | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const changedTime = !reminder || reminder.startDate !== startDate || reminder.time !== time;
  const guard = useDiscardGuard({ title, startDate, time, repeat, endDate, enabled }, 'reminder');

  const save = () => {
    const next: Errors = {};
    if (!title.trim() || title.trim().length > 150)
      next.title = 'Add a short title, like Evening walk.';
    if (!startDate) next.start = 'Pick a start date.';
    if (!time) next.time = 'Pick a time.';
    if (
      startDate &&
      time &&
      changedTime &&
      repeat === 'once' &&
      `${startDate}T${time}` <= `${now.date}T${now.time}`
    )
      next.time = 'Pick a time in the future.';
    if (repeat === 'daily' && endDate && startDate && endDate < startDate)
      next.end = 'Must be on or after the start date.';
    setErrors(next);
    if (Object.keys(next).length || !petId || !startDate || !time) return;
    const data = {
      petId,
      title: title.trim(),
      startDate,
      time,
      repeat,
      endDate: repeat === 'daily' ? endDate : undefined,
      enabled,
    };
    if (reminder) actions.updateCustomReminder(reminder.id, data);
    else actions.addCustomReminder(data);
    toast.show('Reminder saved');
    guard.leave(() => router.back());
  };

  return (
    <StackScreen
      layout="form"
      gap={space[2] + 2}
      header={<ModalHeader title={reminder ? 'Edit reminder' : 'New reminder'} onAction={save} />}
    >
      <FieldGroup label="For">
        <BleedRow>
          {pets.map((p) => (
            <PetPill
              key={p.id}
              name={p.name}
              avatar={p.avatar}
              selected={p.id === petId}
              onPress={() => setPetId(p.id)}
            />
          ))}
        </BleedRow>
      </FieldGroup>
      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Evening walk"
        maxLength={150}
        error={errors.title}
      />
      <FieldRow>
        <Field
          label="Starts"
          value={startDate ? formatDate(startDate) : ''}
          placeholder="Date"
          trailingIcon="calendar"
          onPress={() => setSheet('start')}
          error={errors.start}
          style={half}
        />
        <Field
          label="At"
          value={time ? formatTime12h(time) : ''}
          placeholder="Time"
          trailingIcon="clock"
          onPress={() => setSheet('time')}
          error={errors.time}
          style={half}
        />
      </FieldRow>
      <FieldGroup label="Repeat">
        <SegmentedControl
          segments={REPEAT}
          value={repeat}
          onChange={setRepeat}
          accessibilityLabel="Repeat"
        />
      </FieldGroup>
      <Field
        label="Ends on (optional)"
        value={endDate && repeat === 'daily' ? formatDate(endDate) : ''}
        placeholder="No end date"
        trailingIcon="calendar"
        helper="Only for daily reminders."
        disabled={repeat !== 'daily'}
        error={errors.end}
        onPress={() => setSheet('end')}
      />
      <AppText variant="caption" color={palette.text.secondary}>
        In {zoneLabel(state.owner.timeZone)}.
      </AppText>
      <ToggleRow
        title="Reminder on"
        helper="Turn off to pause without deleting"
        value={enabled}
        onValueChange={setEnabled}
      />
      {reminder ? (
        <Button
          label="Delete reminder"
          icon="trash"
          variant="ghost"
          block
          onPress={() => setSheet('delete')}
        />
      ) : null}

      <DateSheet
        visible={sheet === 'start' || sheet === 'end'}
        title={sheet === 'start' ? 'Starts' : 'Ends on'}
        value={sheet === 'start' ? startDate : endDate}
        minDate={sheet === 'end' ? startDate : today}
        onClose={() => setSheet(null)}
        onDone={(d) => {
          if (sheet === 'start') setStartDate(d);
          else setEndDate(d);
          setSheet(null);
        }}
      />
      <TimeSheet
        visible={sheet === 'time'}
        title="Reminder time"
        value={time ?? '09:00'}
        caption={`In ${zoneLabel(state.owner.timeZone)}.`}
        onClose={() => setSheet(null)}
        onDone={(t) => {
          setTime(t);
          setSheet(null);
        }}
      />
      {reminder ? (
        <BottomSheet
          visible={sheet === 'delete'}
          title={`Delete “${reminder.title}”?`}
          onClose={() => setSheet(null)}
        >
          <AppText variant="bodyM" color={palette.text.secondary}>
            Its pending reminders are canceled. Reminders already in your Inbox stay there.
          </AppText>
          <Button
            label="Delete reminder"
            icon="trash"
            variant="destructive"
            block
            onPress={() => {
              actions.deleteCustomReminder(reminder.id);
              setSheet(null);
              toast.show('Reminder deleted');
              guard.leave(() => router.back());
            }}
          />
          <Button label="Keep it" variant="ghost" block onPress={() => setSheet(null)} />
        </BottomSheet>
      ) : null}
      {guard.dialog}
    </StackScreen>
  );
}
