import { router } from 'expo-router';
import { useState } from 'react';
import { SelectSheet, TimeSheet } from '@/components/sheets';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { ToggleRow } from '@/components/ui/toggle';
import { formatTime12h } from '@/lib/format';
import { useStore } from '@/lib/store';
import { color as palette } from '@/theme/tokens';

/**
 * Figma: 80 Settings & Account / Notification preferences (Default, Push off, Saved). RM-01.
 * TODO(push): ask the OS for permission and register the device token when push ships.
 */
export default function NotificationPrefsScreen() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [push, setPush] = useState(state.prefs.push);
  const [visitLead, setVisitLead] = useState<'1' | '24'>(
    String(state.prefs.visitLeadHours) as '1' | '24',
  );
  const [vaccineLead, setVaccineLead] = useState<'7' | '1'>(
    String(state.prefs.vaccineLeadDays) as '7' | '1',
  );
  const [time, setTime] = useState(state.prefs.dateOnlyTime);
  const [sheet, setSheet] = useState<'visit' | 'vaccine' | 'time' | null>(null);

  return (
    <StackScreen
      header={<DetailHeader title="Notifications" />}
      bottomBar={
        <Button
          label="Save"
          block
          onPress={() => {
            actions.updatePrefs({
              push,
              visitLeadHours: visitLead === '1' ? 1 : 24,
              vaccineLeadDays: vaccineLead === '7' ? 7 : 1,
              dateOnlyTime: time,
            });
            toast.show('Notification settings saved');
            router.back();
          }}
        />
      }
    >
      <ToggleRow
        title="Push notifications"
        helper={push ? 'On for this phone' : 'Off on this phone'}
        value={push}
        onValueChange={setPush}
      />
      {!push ? (
        <Banner
          tone="warning"
          title="Push is off"
          body="Reminders still appear in your Inbox. Turn push on to see them on your lock screen."
        />
      ) : null}
      <SectionHeader title="Timing" />
      <Field
        label="Visit reminders"
        value={visitLead === '1' ? '1 hour before' : '24 hours before'}
        trailingIcon="chevron-down"
        onPress={() => setSheet('visit')}
      />
      <Field
        label="Vaccine reminders"
        value={vaccineLead === '7' ? '7 days before the due date' : '1 day before the due date'}
        trailingIcon="chevron-down"
        onPress={() => setSheet('vaccine')}
      />
      <Field
        label="Send date-only reminders at"
        value={formatTime12h(time)}
        trailingIcon="chevron-down"
        helper={`For vaccines and supply alerts, in ${state.owner.timeZone} time.`}
        onPress={() => setSheet('time')}
      />
      <AppText variant="caption" color={palette.text.secondary}>
        Dose reminders follow each prescription’s own times. Lock-screen alerts never show health
        details.
      </AppText>

      <SelectSheet
        visible={sheet === 'visit'}
        title="Visit reminders"
        options={[
          { value: '24', label: '24 hours before' },
          { value: '1', label: '1 hour before' },
        ]}
        value={visitLead}
        onSelect={setVisitLead}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet === 'vaccine'}
        title="Vaccine reminders"
        options={[
          { value: '7', label: '7 days before the due date' },
          { value: '1', label: '1 day before the due date' },
        ]}
        value={vaccineLead}
        onSelect={setVaccineLead}
        onClose={() => setSheet(null)}
      />
      <TimeSheet
        visible={sheet === 'time'}
        title="Date-only reminder time"
        value={time}
        caption={`In ${state.owner.timeZone}.`}
        onClose={() => setSheet(null)}
        onDone={(t) => {
          setTime(t);
          setSheet(null);
        }}
      />
    </StackScreen>
  );
}
