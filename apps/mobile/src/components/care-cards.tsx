import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Avatar, type AvatarKey } from '@/components/ui/avatar';
import {
  DoseCheck,
  IconTile,
  MetaTag,
  StatusBadge,
  TypeTag,
  type DoseCheckState,
} from '@/components/ui/badges';
import type { IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import type { IllustrationName } from '@/components/ui/illustration';
import { doseBadge, type DoseStatus } from '@/lib/care-status';
import { splitTime12h } from '@/lib/format';
import { color as palette, radius, space, type RecordKind, type StatusKey } from '@/theme/tokens';

const pressed = { opacity: 0.85 } as const;

/** Figma "Next Visit Card": Home hero for the next Planned visit of the active pet. */
export function NextVisitCard({
  title,
  place,
  date,
  time,
  avatar,
  petName,
  onPress,
}: {
  title: string;
  place: string;
  date: string;
  time: string;
  avatar?: AvatarKey;
  petName: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.nextVisit}>
      <View style={styles.rowCenter}>
        <AppText variant="overline" style={styles.grow}>
          Next visit
        </AppText>
        <IconButton
          icon="arrow-up-right"
          size={32}
          accessibilityLabel={`Open visit: ${title}`}
          onPress={onPress}
        />
      </View>
      <AppText variant="titleL">{title}</AppText>
      <AppText variant="bodyM" color={palette.text.secondary} numberOfLines={1}>
        {place}
      </AppText>
      <View style={styles.nextVisitMeta}>
        <MetaTag icon="calendar" label={date} />
        <MetaTag icon="clock" label={time} />
        <View style={styles.grow} />
        <Avatar avatar={avatar} size={32} accessibilityLabel={petName} />
      </View>
    </View>
  );
}

/** Figma "Quick Action": Home shortcut tile. */
export function QuickAction({
  label,
  illustration,
  tint,
  onPress,
}: {
  label: string;
  illustration: IllustrationName;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed: p }) => [styles.quickAction, { backgroundColor: tint }, p && pressed]}
    >
      <IconTile illustration={illustration} size="medium" />
      <AppText variant="buttonS" align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const CHECK_FOR: Record<DoseStatus, DoseCheckState> = {
  upcoming: 'todo',
  due: 'todo',
  overdue: 'overdue',
  taken: 'taken',
  skipped: 'skipped',
};

/** Figma "Dose Row": scheduled time, medication, derived status and the Dose Check. */
export function DoseRow({
  medication,
  time,
  detail,
  status,
  onPress,
}: {
  medication: string;
  time: string;
  detail: string;
  status: DoseStatus;
  onPress?: () => void;
}) {
  const { time: clock, period } = splitTime12h(time);
  const badge = doseBadge(status);
  const bg =
    status === 'due'
      ? palette.tint.yellow
      : status === 'overdue'
        ? palette.danger.subtle
        : palette.bg.surface;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${clock} ${period}, ${medication}, ${detail}, ${badge.label}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed: p }) => [styles.doseRow, { backgroundColor: bg }, p && pressed]}
    >
      <View style={styles.when}>
        <AppText variant="titleS">{clock}</AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {period}
        </AppText>
      </View>
      <View style={styles.doseText}>
        <AppText
          variant="titleS"
          color={status === 'skipped' ? palette.text.secondary : palette.text.primary}
        >
          {medication}
        </AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {detail}
        </AppText>
        <StatusBadge status={badge.status} label={badge.label} />
      </View>
      <DoseCheck state={CHECK_FOR[status]} medication={medication} onPress={onPress} />
    </Pressable>
  );
}

/** Figma "Vaccine Row": an administered vaccine or open due item. Statuses are derived. */
export function VaccineRow({
  name,
  detail,
  status,
  onPress,
}: {
  name: string;
  detail: string;
  /** Omit for a plain "Given" row with a chevron. */
  status?: Extract<StatusKey, 'due-soon' | 'due' | 'overdue' | 'fulfilled' | 'upcoming'>;
  onPress?: () => void;
}) {
  const overdue = status === 'overdue';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}, ${detail}${status ? `, ${status.replace('-', ' ')}` : ''}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed: p }) => [
        styles.vaccineRow,
        overdue && { backgroundColor: palette.danger.subtle },
        p && pressed,
      ]}
    >
      <IconTile illustration="syringe" tone={overdue ? 'white' : 'blue'} />
      <View style={styles.grow2}>
        <AppText variant="titleS">{name}</AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {detail}
        </AppText>
      </View>
      {status ? <StatusBadge status={status} /> : null}
    </Pressable>
  );
}

/** Figma "Prescription Card": owner-entered medication with derived lifecycle. */
export function PrescriptionCard({
  medication,
  instructions,
  state,
  modeLabel,
  timesLabel,
  dateRange,
  onPress,
}: {
  medication: string;
  instructions: string;
  state: Extract<StatusKey, 'active' | 'ended' | 'stopped' | 'upcoming'>;
  modeLabel: string;
  timesLabel?: string;
  dateRange?: string;
  onPress?: () => void;
}) {
  const live = state === 'active' || state === 'upcoming';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${medication}, ${instructions}, ${state}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed: p }) => [
        styles.rxCard,
        { backgroundColor: live ? palette.kind.prescription : palette.bg.surface },
        p && pressed,
      ]}
    >
      <View style={styles.rowCenter12}>
        <IconTile illustration="pill-bottle" />
        <View style={styles.grow2}>
          <AppText variant="titleS" color={live ? palette.text.primary : palette.text.secondary}>
            {medication}
          </AppText>
          <AppText variant="caption" color={palette.text.secondary}>
            {instructions}
          </AppText>
        </View>
        <StatusBadge status={state} />
      </View>
      <View style={styles.wrap6}>
        <TypeTag label={modeLabel} />
        {timesLabel ? <MetaTag icon="clock" label={timesLabel} /> : null}
        {dateRange ? <MetaTag icon="calendar" label={dateRange} /> : null}
      </View>
    </Pressable>
  );
}

const KIND_ART: Record<RecordKind, IllustrationName> = {
  medical: 'first-aid',
  vaccine: 'syringe',
  prescription: 'pill-bottle',
  visit: 'calendar',
};

export type RecordMeta = { icon?: IconName; label: string };

/** Figma "Record Card": timeline entry tinted by kind; voided records turn neutral. */
export function RecordCard({
  kind,
  context,
  title,
  body,
  meta,
  voided = false,
  onPress,
}: {
  kind: RecordKind;
  context: string;
  title: string;
  body?: string;
  meta: RecordMeta[];
  voided?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${context}, ${title}${voided ? ', voided' : ''}`}
      onPress={onPress}
      style={({ pressed: p }) => [
        styles.record,
        voided ? styles.recordVoided : { backgroundColor: palette.kind[kind] },
        p && pressed,
      ]}
    >
      <View style={styles.recordTop}>
        <View style={styles.grow2}>
          <AppText variant="caption" color={palette.text.secondary}>
            {context}
          </AppText>
          <AppText variant="titleS" color={voided ? palette.text.secondary : palette.text.primary}>
            {title}
          </AppText>
        </View>
        <IconTile illustration={KIND_ART[kind]} />
      </View>
      {body ? (
        <AppText
          variant="bodyM"
          color={voided ? palette.text.secondary : palette.text.primary}
          numberOfLines={3}
        >
          {body}
        </AppText>
      ) : null}
      {meta.length || voided ? (
        <View style={styles.wrap6}>
          {voided ? <StatusBadge status="voided" /> : null}
          {meta.map((m) => (
            <MetaTag
              key={`${m.icon}-${m.label}`}
              icon={m.icon}
              label={m.label}
              surface={voided ? 'surface' : 'white'}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/** Timeline row: date column (Title M day, caption month) + Record Card. */
export function TimelineRow({
  day,
  month,
  children,
}: {
  day: string;
  month: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.timelineRow}>
      <View
        style={styles.dateCol}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <AppText variant="titleM">{day}</AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {month}
        </AppText>
      </View>
      <View style={styles.grow2}>{children}</View>
    </View>
  );
}

type VisitStatus = Extract<
  StatusKey,
  'planned' | 'needs-update' | 'completed' | 'missed' | 'canceled'
>;

/** Figma "Appointment Card": diary entry with its status; Needs update is derived. */
export function AppointmentCard({
  day,
  month,
  title,
  subtitle,
  time,
  status,
  onPress,
}: {
  day: string;
  month: string;
  title: string;
  subtitle: string;
  time: string;
  status: VisitStatus;
  onPress?: () => void;
}) {
  const live = status === 'planned' || status === 'needs-update';
  const muted = status === 'missed' || status === 'canceled';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${day} ${month}, ${time}, ${subtitle}, ${status.replace('-', ' ')}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed: p }) => [styles.appointment, p && pressed]}
    >
      <View
        style={[
          styles.dateBlock,
          { backgroundColor: live ? palette.kind.visit : palette.bg.surface },
        ]}
      >
        <AppText variant="numeric" color={muted ? palette.text.secondary : palette.text.primary}>
          {day}
        </AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {month}
        </AppText>
      </View>
      <View style={styles.apptText}>
        <AppText variant="titleS" color={muted ? palette.text.secondary : palette.text.primary}>
          {title}
        </AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {subtitle}
        </AppText>
        <View style={styles.rowCenter6}>
          <MetaTag icon="clock" label={time} surface="surface" />
          <StatusBadge status={status} />
        </View>
      </View>
    </Pressable>
  );
}

/** Detail hero card: tags, optional overline, Title L, optional body and meta tags. */
export function RecordHero({
  tint,
  tags,
  overline,
  title,
  body,
  meta = [],
  muted = false,
}: {
  tint: string;
  tags: ReactNode;
  overline?: string;
  title: string;
  body?: string;
  meta?: RecordMeta[];
  muted?: boolean;
}) {
  return (
    <View style={[styles.hero, { backgroundColor: muted ? palette.bg.surface : tint }]}>
      <View style={styles.wrap8}>{tags}</View>
      {overline ? (
        <AppText variant="overline" color={palette.text.secondary}>
          {overline}
        </AppText>
      ) : null}
      <AppText
        variant="titleL"
        color={muted ? palette.text.secondary : palette.text.primary}
        accessibilityRole="header"
      >
        {title}
      </AppText>
      {body ? (
        <AppText variant="bodyM" color={palette.text.secondary}>
          {body}
        </AppText>
      ) : null}
      {meta.length ? (
        <View style={styles.wrap6}>
          {meta.map((m) => (
            <MetaTag key={`${m.icon}-${m.label}`} icon={m.icon} label={m.label} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Pet profile hero: 84 px avatar, Display name, kind and birth tag. */
export function PetHero({
  name,
  kind,
  born,
  avatar,
  tint,
  archived = false,
}: {
  name: string;
  kind: string;
  born: string;
  avatar?: AvatarKey;
  tint: string;
  archived?: boolean;
}) {
  return (
    <View style={[styles.petHero, { backgroundColor: archived ? palette.bg.surface : tint }]}>
      <View style={archived ? styles.faded : null}>
        <Avatar avatar={avatar} size={84} />
      </View>
      <View style={styles.petInfo}>
        <AppText
          variant="display"
          color={archived ? palette.text.secondary : palette.text.primary}
          accessibilityRole="header"
        >
          {name}
        </AppText>
        <AppText variant="bodyM" color={palette.text.secondary}>
          {kind}
        </AppText>
        <MetaTag label={born} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  grow2: { flex: 1, gap: 2 },
  faded: { opacity: 0.6 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowCenter6: { flexDirection: 'row', alignItems: 'center', gap: space[1] + 2, flexWrap: 'wrap' },
  rowCenter12: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  wrap6: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1] + 2 },
  wrap8: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  nextVisit: {
    gap: space[2] + 2,
    padding: space[5],
    borderRadius: radius['2xl'],
    backgroundColor: palette.tint.pink,
  },
  nextVisitMeta: { height: 100, flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[3],
    paddingHorizontal: space[1] + 2,
    borderRadius: radius.xl,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[3] + 2,
    borderRadius: radius.lg,
  },
  when: { width: 52 },
  doseText: { flex: 1, gap: space[1] },
  vaccineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingLeft: space[3] + 2,
    paddingRight: space[3],
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
  },
  rxCard: { gap: space[3], padding: space[4], borderRadius: radius.xl },
  record: { gap: space[2], padding: space[3] + 2, borderRadius: radius.xl },
  recordVoided: {
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  recordTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] + 2 },
  timelineRow: { flexDirection: 'row', gap: space[2] + 2 },
  dateCol: { width: 36, alignItems: 'center', paddingTop: space[1] + 2 },
  appointment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3] + 2,
    paddingVertical: space[3] + 2,
    paddingLeft: space[3] + 2,
    paddingRight: space[4],
    borderRadius: radius.xl,
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  dateBlock: {
    width: 56,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apptText: { flex: 1, gap: space[1] },
  hero: { gap: space[2], padding: space[4] + 2, borderRadius: radius['2xl'] },
  petHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[4] + 2,
    borderRadius: radius['2xl'],
  },
  petInfo: { flex: 1, gap: space[1] },
});
