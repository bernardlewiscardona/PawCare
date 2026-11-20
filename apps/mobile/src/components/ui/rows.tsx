import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color as palette, radius, space, type StatusKey } from '@/theme/tokens';
import { AppText } from './app-text';
import { Avatar, type AvatarKey } from './avatar';
import { IconTile, Radio, StatusBadge, type TileTone } from './badges';
import { Icon, type IconName } from './icon';
import type { IllustrationName } from './illustration';

const pressedStyle = { opacity: 0.85 } as const;

/** Plain surface card (r22) used to group detail rows, ledgers and summaries. */
export function Card({
  children,
  style,
  padded = 'rows',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** rows = 6/16 padding for Detail Rows; ledger = 4/16; content = 16 all round. */
  padded?: 'rows' | 'ledger' | 'content';
}) {
  return <View style={[styles.card, CARD_PAD[padded], style]}>{children}</View>;
}

const CARD_PAD = StyleSheet.create({
  rows: { paddingVertical: space[1] + 2, paddingHorizontal: space[4] },
  ledger: { paddingVertical: space[1], paddingHorizontal: space[4] },
  content: { padding: space[4], gap: space[1] + 2 },
});

/** Figma "Detail Row": read-only key–value pair. */
export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="bodyM" color={palette.text.secondary}>
        {label}
      </AppText>
      <AppText variant="bodyM" align="right" style={styles.grow}>
        {value}
      </AppText>
    </View>
  );
}

/** A surface card of Detail Rows. */
export function DetailCard({ rows }: { rows: [string, string][] }) {
  return (
    <Card>
      {rows.map(([label, value]) => (
        <DetailRow key={label} label={label} value={value} />
      ))}
    </Card>
  );
}

/** Figma "Stat Pill": key figure on profiles and item detail. */
export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" color={palette.text.secondary}>
        {label}
      </AppText>
      <AppText variant="titleS" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

type ListItemProps = {
  title: string;
  subtitle?: string;
  illustration?: IllustrationName;
  icon?: IconName;
  /** Card = surface card with a white tile; Plain = no background with a surface tile. */
  variant?: 'card' | 'plain';
  chevron?: boolean;
  onPress?: () => void;
  tileTone?: TileTone;
};

/** Figma "List Item": navigation and settings rows. */
export function ListItem({
  title,
  subtitle,
  illustration,
  icon,
  variant = 'card',
  chevron = true,
  onPress,
  tileTone,
}: ListItemProps) {
  const card = variant === 'card';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listItem, card && styles.listCard, pressed && pressedStyle]}
    >
      {illustration ? (
        <IconTile
          illustration={illustration}
          size="medium"
          tone={tileTone ?? (card ? 'white' : 'surface')}
        />
      ) : icon ? (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: card ? palette.bg.screen : palette.bg.surface },
          ]}
        >
          <Icon name={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.grow}>
        <AppText variant="titleS">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={palette.text.secondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {chevron && onPress ? (
        <Icon name="chevron-right" size={20} color={palette.text.secondary} />
      ) : null}
    </Pressable>
  );
}

type SelectRowProps = {
  title: string;
  subtitle?: string;
  avatar?: AvatarKey;
  showAvatar?: boolean;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Figma "Select Row": card selector for pets, visits, due vaccines, supplies and batches. */
export function SelectRow({
  title,
  subtitle,
  avatar,
  showAvatar,
  selected,
  disabled,
  onPress,
}: SelectRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.select, selected && styles.selectOn, disabled && styles.muted]}
    >
      {showAvatar ? <Avatar avatar={avatar} size={40} /> : null}
      <View style={styles.grow}>
        <AppText variant="titleS">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={palette.text.secondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Radio selected={selected} />
    </Pressable>
  );
}

/** Figma "Pet Card": My pets list. Archived pets are read-only and muted. */
export function PetCard({
  name,
  subtitle,
  avatar,
  archived,
  onPress,
}: {
  name: string;
  subtitle: string;
  avatar?: AvatarKey;
  archived?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subtitle}${archived ? ', archived' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.petCard, pressed && pressedStyle]}
    >
      <View style={archived ? styles.muted : null}>
        <Avatar avatar={avatar} size={56} />
      </View>
      <View style={[styles.grow, styles.gap4]}>
        <AppText variant="titleM" color={archived ? palette.text.secondary : palette.text.primary}>
          {name}
        </AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {subtitle}
        </AppText>
        {archived ? <StatusBadge status="archived" /> : null}
      </View>
      <Icon name="chevron-right" size={20} color={palette.text.secondary} />
    </Pressable>
  );
}

/** Figma "Supply Row": household item with usable quantity and its open alert. */
export function SupplyRow({
  name,
  subtitle,
  illustration,
  quantity,
  alert,
  onPress,
}: {
  name: string;
  subtitle: string;
  illustration: IllustrationName;
  quantity: string;
  alert?: Extract<StatusKey, 'low-stock' | 'expiring' | 'expired'>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subtitle}, ${quantity} usable`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedStyle]}
    >
      <IconTile illustration={illustration} />
      <View style={styles.grow}>
        <AppText variant="titleS">{name}</AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {subtitle}
        </AppText>
      </View>
      <View style={styles.trailing}>
        <AppText variant="titleS">{quantity}</AppText>
        {alert ? (
          <StatusBadge status={alert} />
        ) : (
          <AppText variant="caption" color={palette.text.secondary}>
            usable
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

/** Figma "Batch Row": stock batch with derived expiry. */
export function BatchRow({
  label,
  expiry,
  quantity,
  status,
}: {
  label: string;
  expiry: string;
  quantity: string;
  status: Extract<StatusKey, 'usable' | 'expiring' | 'expired' | 'unknown-expiry'>;
}) {
  return (
    <View style={[styles.row, styles.batch]} accessible>
      <View style={styles.grow}>
        <AppText variant="titleS">{label}</AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {expiry}
        </AppText>
      </View>
      <View style={[styles.trailing, styles.gap4]}>
        <AppText variant="titleS">{quantity}</AppText>
        <StatusBadge status={status} />
      </View>
    </View>
  );
}

export type LedgerType = 'opening' | 'restocked' | 'used' | 'disposed' | 'adjusted' | 'reversed';

const LEDGER: Record<LedgerType, { label: string; icon: IconName }> = {
  opening: { label: 'Opening', icon: 'plus' },
  restocked: { label: 'Restocked', icon: 'plus' },
  used: { label: 'Used', icon: 'minus' },
  disposed: { label: 'Disposed', icon: 'trash' },
  adjusted: { label: 'Adjusted', icon: 'sliders' },
  reversed: { label: 'Reversed', icon: 'rotate-ccw' },
};

/** Figma "Ledger Row": immutable stock transaction with its signed quantity. */
export function LedgerRow({
  type,
  detail,
  quantity,
  onPress,
}: {
  type: LedgerType;
  detail: string;
  quantity: string;
  onPress?: () => void;
}) {
  const meta = LEDGER[type];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${meta.label}, ${detail}, ${quantity}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.ledger, pressed && pressedStyle]}
    >
      <View style={styles.ledgerIcon}>
        <Icon name={meta.icon} size={18} />
      </View>
      <View style={styles.grow}>
        <AppText variant="titleS">{meta.label}</AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {detail}
        </AppText>
      </View>
      <AppText variant="titleS">{quantity}</AppText>
    </Pressable>
  );
}

export type ReminderState = 'unread' | 'read' | 'delayed' | 'no-longer-needed';

/** Figma "Reminder Row": an inbox occurrence. Read state is independent of task completion. */
export function ReminderRow({
  state,
  title,
  detail,
  time,
  illustration,
  onPress,
}: {
  state: ReminderState;
  title: string;
  detail: string;
  time: string;
  illustration: IllustrationName;
  onPress: () => void;
}) {
  const unread = state === 'unread';
  const stale = state === 'no-longer-needed';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${title}, ${detail}, ${time}${state === 'delayed' ? ', delayed' : ''}${stale ? ', no longer needed' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.reminder,
        unread ? styles.reminderUnread : null,
        pressed && pressedStyle,
      ]}
    >
      <IconTile illustration={illustration} tone={unread ? 'yellow' : 'white'} />
      <View style={[styles.grow, styles.gap4]}>
        <AppText variant="titleS" color={stale ? palette.text.secondary : palette.text.primary}>
          {title}
        </AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {detail}
        </AppText>
        <View style={styles.reminderMeta}>
          <AppText variant="caption" color={palette.text.secondary}>
            {time}
          </AppText>
          {state === 'delayed' ? <StatusBadge status="delayed" /> : null}
          {stale ? <StatusBadge status="no-longer-needed" /> : null}
        </View>
      </View>
      {unread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: 2 },
  gap4: { gap: space[1] },
  muted: { opacity: 0.6 },
  card: { borderRadius: radius.xl, backgroundColor: palette.bg.surface },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[2] + 2,
  },
  stat: {
    flex: 1,
    gap: 2,
    paddingVertical: space[3],
    paddingHorizontal: space[3] + 2,
    borderRadius: radius.lg,
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2] + 2,
  },
  listCard: {
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingLeft: space[3] + 2,
    paddingRight: space[3],
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectOn: { backgroundColor: palette.bg.screen, borderColor: palette.border.focus },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3] + 2,
    paddingVertical: space[3] + 2,
    paddingLeft: space[4],
    paddingRight: space[3] + 2,
    borderRadius: radius.xl,
    backgroundColor: palette.bg.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingLeft: space[3] + 2,
    paddingRight: space[3],
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
  },
  batch: { paddingRight: space[3] + 2 },
  trailing: { alignItems: 'flex-end', gap: space[1] },
  ledger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2] + 2,
  },
  ledgerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg.surface,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[3] + 2,
    paddingLeft: space[3] + 2,
    paddingRight: space[3],
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reminderUnread: { backgroundColor: palette.bg.screen, borderColor: palette.border.default },
  reminderMeta: { flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent.pink },
});
