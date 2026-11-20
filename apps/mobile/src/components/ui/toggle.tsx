import { Pressable, StyleSheet, View } from 'react-native';
import { color as palette, radius, shadow, space } from '@/theme/tokens';
import { AppText } from './app-text';

type ToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

/** Figma "Toggle": 48 × 28 track, 22 px knob. State is exposed as a switch. */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[styles.track, value ? styles.on : styles.off, disabled && styles.disabled]}
    >
      <View style={[styles.knob, value ? styles.knobOn : null]} />
    </Pressable>
  );
}

/** Plain label + toggle on one line (Timeline "Show voided records"). */
export function InlineToggle({
  label,
  ...toggle
}: Omit<ToggleProps, 'accessibilityLabel'> & { label: string }) {
  return (
    <View style={styles.inline}>
      <AppText variant="bodyM" color={palette.text.secondary} style={styles.grow}>
        {label}
      </AppText>
      <Toggle {...toggle} accessibilityLabel={label} />
    </View>
  );
}

/** Figma "Toggle Row": a surface card with title, helper text and a toggle. */
export function ToggleRow({
  title,
  helper,
  muted = false,
  onPress,
  ...toggle
}: Omit<ToggleProps, 'accessibilityLabel'> & {
  title: string;
  helper?: string;
  muted?: boolean;
  onPress?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.grow}
        disabled={!onPress}
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Edit ${title}` : undefined}
      >
        <AppText variant="titleS" color={muted ? palette.text.secondary : palette.text.primary}>
          {title}
        </AppText>
        {helper ? (
          <AppText variant="caption" color={palette.text.secondary}>
            {helper}
          </AppText>
        ) : null}
      </Pressable>
      <Toggle {...toggle} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: radius.full, padding: 3, justifyContent: 'center' },
  off: { backgroundColor: palette.bg.surfaceStrong },
  on: { backgroundColor: palette.primary.default },
  disabled: { opacity: 0.5 },
  knob: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: palette.bg.screen,
    ...shadow.soft,
  },
  knobOn: { alignSelf: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 28 },
  grow: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3] + 2,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
  },
});
