import { Pressable, StyleSheet, View } from 'react-native';
import {
  color as palette,
  primitives as p,
  radius,
  space,
  statusColor,
  type RecordKind,
  type StatusKey,
} from '@/theme/tokens';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';
import { Illustration, type IllustrationName } from './illustration';

/** Text for every Figma "Status Badge" variant. */
export const STATUS_LABEL: Record<StatusKey, string> = {
  planned: 'Planned',
  'needs-update': 'Needs update',
  completed: 'Completed',
  missed: 'Missed',
  canceled: 'Canceled',
  active: 'Active',
  voided: 'Voided',
  'due-soon': 'Due soon',
  due: 'Due today',
  overdue: 'Overdue',
  fulfilled: 'Fulfilled',
  ended: 'Ended',
  stopped: 'Stopped',
  taken: 'Taken',
  skipped: 'Skipped',
  upcoming: 'Upcoming',
  'due-now': 'Due now',
  'low-stock': 'Low stock',
  expiring: 'Expiring soon',
  expired: 'Expired',
  usable: 'Usable',
  'unknown-expiry': 'Unknown expiry',
  scanning: 'Scanning',
  rejected: 'Rejected',
  failed: 'Failed',
  archived: 'Archived',
  delayed: 'Delayed',
  'no-longer-needed': 'No longer needed',
};

type Tone = 'info' | 'warning' | 'success' | 'danger' | 'neutral';

const TONE_DOT: Record<Tone, string> = {
  info: p.blue400,
  warning: p.yellow400,
  success: p.green400,
  danger: p.red500,
  neutral: p.neutral500,
};

const STATUS_TONE: Record<StatusKey, Tone> = {
  planned: 'info',
  'due-soon': 'info',
  scanning: 'info',
  'needs-update': 'warning',
  due: 'warning',
  'due-now': 'warning',
  'low-stock': 'warning',
  expiring: 'warning',
  delayed: 'warning',
  completed: 'success',
  active: 'success',
  fulfilled: 'success',
  taken: 'success',
  usable: 'success',
  missed: 'danger',
  overdue: 'danger',
  expired: 'danger',
  rejected: 'danger',
  failed: 'danger',
  canceled: 'neutral',
  voided: 'neutral',
  ended: 'neutral',
  stopped: 'neutral',
  skipped: 'neutral',
  upcoming: 'neutral',
  'unknown-expiry': 'neutral',
  archived: 'neutral',
  'no-longer-needed': 'neutral',
};

/**
 * Figma "Status Badge": status/* background, tone dot and caption text. The text always carries
 * the status, so it never depends on colour alone.
 */
export function StatusBadge({ status, label }: { status: StatusKey; label?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: statusColor[status] }]}>
      <View style={[styles.dot, { backgroundColor: TONE_DOT[STATUS_TONE[status]] }]} />
      <AppText variant="caption" numberOfLines={1}>
        {label ?? STATUS_LABEL[status]}
      </AppText>
    </View>
  );
}

const KIND_LABEL: Record<RecordKind, string> = {
  medical: 'Medical',
  vaccine: 'Vaccine',
  prescription: 'Medication',
  visit: 'Visit',
};

/** Figma "Kind Tag": CARE_RECORDS.kind. */
export function KindTag({ kind }: { kind: RecordKind }) {
  return (
    <View style={[styles.tag, { backgroundColor: palette.kind[kind] }]}>
      <AppText variant="caption">{KIND_LABEL[kind]}</AppText>
    </View>
  );
}

/** Figma "Type Tag": schedule mode, recurrence, transaction type, provenance, category. */
export function TypeTag({ label }: { label: string }) {
  return (
    <View style={[styles.tag, styles.typeTag]}>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

/** Figma "Meta Tag": date, time, provider or file count. White on tinted cards, Surface on white. */
export function MetaTag({
  icon,
  label,
  surface = 'white',
}: {
  icon?: IconName;
  label: string;
  surface?: 'white' | 'surface';
}) {
  return (
    <View
      style={[
        styles.meta,
        { backgroundColor: surface === 'white' ? palette.bg.screen : palette.bg.surface },
      ]}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export type TileTone = 'white' | 'surface' | 'pink' | 'blue' | 'green' | 'yellow' | 'red';

const TILE_BG: Record<TileTone, string> = {
  white: palette.bg.screen,
  surface: palette.bg.surface,
  pink: palette.tint.pink,
  blue: palette.tint.blue,
  green: palette.tint.green,
  yellow: palette.tint.yellow,
  red: palette.danger.subtle,
};

const TILE_SIZE = {
  small: { edge: 36, radius: radius.md, art: 26 },
  medium: { edge: 44, radius: radius.md, art: 32 },
  large: { edge: 72, radius: radius.xl, art: 48 },
} as const;

/** Figma "Icon Tile": illustration on a tinted tile; tone follows the record kind or alert. */
export function IconTile({
  illustration,
  size = 'small',
  tone = 'white',
}: {
  illustration: IllustrationName;
  size?: keyof typeof TILE_SIZE;
  tone?: TileTone;
}) {
  const s = TILE_SIZE[size];
  return (
    <View
      style={[
        styles.tile,
        { width: s.edge, height: s.edge, borderRadius: s.radius, backgroundColor: TILE_BG[tone] },
      ]}
    >
      <Illustration name={illustration} size={s.art} />
    </View>
  );
}

export type DoseCheckState = 'todo' | 'taken' | 'skipped' | 'overdue';

/** Figma "Dose Check": opens the dose actions. Overdue is derived and shown as a red ring. */
export function DoseCheck({
  state,
  medication,
  onPress,
}: {
  state: DoseCheckState;
  medication: string;
  onPress?: () => void;
}) {
  const label =
    state === 'taken'
      ? `${medication}, taken`
      : state === 'skipped'
        ? `${medication}, skipped`
        : `Log dose of ${medication}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={10}
      style={[styles.check, CHECK_STYLE[state]]}
    >
      {state === 'taken' ? <Icon name="check" size={16} /> : null}
      {state === 'skipped' ? <Icon name="minus" size={16} color={palette.text.secondary} /> : null}
    </Pressable>
  );
}

/** Figma "Radio": single choice inside Select Row. Decorative; the row carries the state. */
export function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected ? styles.radioOn : styles.radioOff]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1] + 2,
    paddingLeft: space[2],
    paddingRight: space[2] + 2,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tag: {
    minHeight: 24,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space[2] + 2,
    paddingVertical: space[1],
    borderRadius: radius.full,
  },
  typeTag: {
    minHeight: 26,
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  meta: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1] + 2,
    paddingLeft: space[2],
    paddingRight: space[2] + 2,
    borderRadius: radius.full,
  },
  tile: { alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: palette.bg.inverse },
  radioOff: {
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.bg.screen },
});

const CHECK_STYLE = StyleSheet.create({
  todo: {
    backgroundColor: palette.bg.screen,
    borderWidth: 1.5,
    borderColor: palette.border.default,
  },
  taken: { backgroundColor: palette.success.default },
  skipped: { backgroundColor: palette.bg.surfaceStrong },
  overdue: {
    backgroundColor: palette.bg.screen,
    borderWidth: 1.5,
    borderColor: palette.border.danger,
  },
});
