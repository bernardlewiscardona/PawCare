import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppointmentCard, DoseRow, VaccineRow } from '@/components/care-cards';
import { AppText } from '@/components/ui/app-text';
import { Button, ButtonRow } from '@/components/ui/button';
import { Banner, EmptyState, useToast } from '@/components/ui/feedback';
import { RootHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { ListItem, ReminderRow } from '@/components/ui/rows';
import { TabScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { vaccineDueState } from '@/lib/care-status';
import { doseStatus, visitDisplayStatus } from '@/lib/derive';
import { formatDayMonth, formatTime12h } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { InboxItem } from '@/lib/types';
import { color as palette, space } from '@/theme/tokens';

/** Figma: 70 Reminders / Inbox (Default, Push off, Empty) and Reminder actions. RM-04. */
export default function InboxScreen() {
  const { state, actions } = useStore();
  const [open, setOpen] = useState<InboxItem | null>(null);
  const scheduled = state.customReminders.length;
  const today = state.inbox.filter((r) => r.section === 'today');
  const earlier = state.inbox.filter((r) => r.section === 'earlier');

  const openItem = (item: InboxItem) => {
    actions.markRead(item.id);
    setOpen(item);
  };

  return (
    <TabScreen
      header={
        <RootHeader
          title="Inbox"
          actions={[
            {
              icon: 'settings',
              label: 'Notification settings',
              onPress: () => router.push('/settings/notifications'),
            },
            {
              icon: 'plus',
              label: 'New custom reminder',
              onPress: () => router.push('/reminders/new'),
            },
          ]}
        />
      }
    >
      {!state.prefs.push ? (
        <Banner
          tone="warning"
          title="Push is off"
          body="You’ll only see reminders here, not on your lock screen."
          actionLabel="Turn on"
          onAction={() => router.push('/settings/notifications')}
        />
      ) : null}
      {state.inbox.length === 0 ? (
        <EmptyState
          illustration="bell"
          title="You’re all caught up"
          body="Dose, vaccine, visit and supply reminders show up here, even when push is off."
          actionLabel="Add a reminder"
          onAction={() => router.push('/reminders/new')}
        />
      ) : (
        <>
          <ListItem
            title="Custom reminders"
            subtitle={`${scheduled} scheduled · walks, grooming, litter`}
            illustration="bell"
            tileTone="yellow"
            onPress={() => router.push('/reminders')}
          />
          {today.length ? <SectionHeader title="Today" /> : null}
          {today.map((r) => (
            <ReminderRow
              key={r.id}
              state={r.state}
              title={r.title}
              detail={r.detail}
              time={r.time}
              illustration={r.illustration}
              onPress={() => openItem(r)}
            />
          ))}
          {earlier.length ? <SectionHeader title="Earlier" /> : null}
          {earlier.map((r) => (
            <ReminderRow
              key={r.id}
              state={r.state}
              title={r.title}
              detail={r.detail}
              time={r.time}
              illustration={r.illustration}
              onPress={() => openItem(r)}
            />
          ))}
        </>
      )}
      <ReminderActions item={open} onClose={() => setOpen(null)} />
    </TabScreen>
  );
}

/**
 * Actions for one occurrence. The source is re-checked on open: unavailable or changed sources
 * show that state instead of acting (RM-02, RM-04). Snooze and read never complete care.
 */
function ReminderActions({ item, onClose }: { item: InboxItem | null; onClose: () => void }) {
  const { state, today, now, actions } = useStore();
  const toast = useToast();
  if (!item)
    return (
      <BottomSheet visible={false} title="" onClose={onClose}>
        {null}
      </BottomSheet>
    );

  const dismiss = () => {
    actions.dismiss(item.id);
    onClose();
  };
  const snooze = () => {
    toast.show('Snoozed for 15 minutes');
    onClose();
  };
  const stale = item.state === 'no-longer-needed';
  const snoozeRow = (
    <ButtonRow>
      <Button
        label="Snooze 15 min"
        icon="clock"
        variant="secondary"
        style={styles.grow}
        disabled={stale}
        onPress={snooze}
      />
      <Button label="Dismiss" variant="ghost" style={styles.grow} onPress={dismiss} />
    </ButtonRow>
  );

  let body: ReactNode = null;
  if (item.source === 'dose') {
    const rx = state.prescriptions.find((r) => r.id === item.sourceId);
    const occ = item.occurrence;
    const log =
      rx && occ
        ? state.doseLogs.find(
            (l) => l.prescriptionId === rx.id && l.date === occ.date && l.time === occ.time,
          )
        : undefined;
    if (!rx || !occ || rx.stoppedOn) {
      body = (
        <Banner
          tone="neutral"
          title="This dose is no longer scheduled"
          body="The prescription changed or stopped. Nothing was logged."
        />
      );
    } else {
      const status = doseStatus(occ.date, occ.time, log, now);
      const pet = state.pets.find((p) => p.id === rx.petId);
      body = (
        <>
          <DoseRow
            medication={rx.medication}
            time={occ.time}
            detail={[pet?.name, rx.doseLabel ?? rx.instructions].filter(Boolean).join(' · ')}
            status={status}
          />
          {log ? (
            <Banner
              tone="success"
              body={`Already logged as ${log.status}${log.at ? ` at ${formatTime12h(log.at)}` : ''}.`}
            />
          ) : (
            <ButtonRow>
              <Button
                label="Skipped"
                variant="secondary"
                style={styles.grow}
                onPress={() => {
                  actions.logDose(rx.id, occ.date, occ.time, 'skipped');
                  toast.show('Dose logged as skipped');
                  onClose();
                }}
              />
              <Button
                label="Taken"
                icon="check"
                style={styles.grow}
                onPress={() => {
                  actions.logDose(rx.id, occ.date, occ.time, 'taken');
                  toast.show('Dose logged as taken');
                  onClose();
                }}
              />
            </ButtonRow>
          )}
          <ButtonRow>
            <Button
              label="Snooze 15 min"
              icon="clock"
              variant="ghost"
              style={styles.grow}
              disabled={Boolean(log)}
              onPress={snooze}
            />
            <Button label="Dismiss" variant="ghost" style={styles.grow} onPress={dismiss} />
          </ButtonRow>
          <AppText variant="caption" color={palette.text.secondary}>
            Reading or snoozing a reminder never marks a dose taken.
          </AppText>
        </>
      );
    }
  } else if (item.source === 'visit') {
    const visit = state.visits.find((v) => v.id === item.sourceId);
    const status = visit ? visitDisplayStatus(visit, now) : undefined;
    if (!visit || status === 'canceled') {
      body = (
        <>
          <Banner
            tone="neutral"
            title="This visit was canceled"
            body="There’s nothing to do for this reminder."
          />
          <Button label="Dismiss" variant="ghost" block onPress={dismiss} />
        </>
      );
    } else {
      const { day, month } = formatDayMonth(visit.date);
      const pet = state.pets.find((p) => p.id === visit.petId);
      body = (
        <>
          <AppointmentCard
            day={day}
            month={month}
            title={visit.title}
            subtitle={`${pet?.name} · ${visit.provider}`}
            time={formatTime12h(visit.start)}
            status={status ?? 'planned'}
          />
          <Button
            label="Open visit"
            block
            onPress={() => {
              onClose();
              router.push(`/visits/${visit.id}`);
            }}
          />
          {snoozeRow}
          <AppText variant="caption" color={palette.text.secondary}>
            Snooze is unavailable once the visit has started.
          </AppText>
        </>
      );
    }
  } else if (item.source === 'vaccine') {
    const vax = state.vaccines.find((v) => v.id === item.sourceId);
    const s = vax?.nextDueOn ? vaccineDueState(vax.nextDueOn, today) : undefined;
    body =
      vax && s && !vax.voidedOn ? (
        <>
          <VaccineRow name={vax.name} detail={s.detail} status={s.status} />
          <Button
            label="Open vaccine"
            block
            onPress={() => {
              onClose();
              router.push(`/vaccines/${vax.id}`);
            }}
          />
          {snoozeRow}
        </>
      ) : (
        <Banner
          tone="neutral"
          title="No longer due"
          body="This vaccine was recorded or changed since the reminder."
        />
      );
  } else if (item.source === 'supply') {
    const sup = state.supplies.find((s) => s.id === item.sourceId);
    body = (
      <>
        <ListItem title={item.title} subtitle={item.detail} illustration={item.illustration} />
        {sup && !sup.archivedOn ? (
          <Button
            label="Open supply"
            block
            onPress={() => {
              onClose();
              router.push(`/supplies/${sup.id}`);
            }}
          />
        ) : null}
        <Button label="Dismiss" variant="ghost" block onPress={dismiss} />
      </>
    );
  } else {
    const custom = state.customReminders.find((r) => r.id === item.sourceId);
    const pet = custom ? state.pets.find((p) => p.id === custom.petId) : undefined;
    body = (
      <>
        <ListItem
          title={item.title}
          subtitle={`${item.detail}${pet ? ` · ${pet.name}` : ''}`}
          illustration={item.illustration}
        />
        <Button
          label="Mark done"
          icon="check"
          block
          onPress={() => {
            actions.dismiss(item.id);
            toast.show('Marked done');
            onClose();
          }}
        />
        {snoozeRow}
      </>
    );
  }

  return (
    <BottomSheet visible title={item.title} onClose={onClose}>
      <View style={styles.body}>{body}</View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  body: { gap: space[3] },
});
