import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { color as palette, radius, space } from '@/theme/tokens';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'large' | 'small';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  /** Stretch to the parent's width. */
  block?: boolean;
  /** Layout only (e.g. `{ flex: 1 }` in a button row). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Pill button — Figma "Button" (Style × Size × State).
 * Loading keeps the label and adds a spinner; it also blocks repeat presses.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'large',
  icon,
  loading = false,
  block = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled);
  const isLarge = size === 'large';
  const onDark = variant === 'primary' || variant === 'destructive';

  const labelColor = isDisabled
    ? palette.text.secondary
    : onDark
      ? palette.text.inverse
      : palette.text.primary;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled || loading, busy: loading }}
      disabled={isDisabled || loading}
      style={({ pressed }) => [
        styles.base,
        isLarge ? styles.large : styles.small,
        surface(variant, isDisabled),
        block && styles.block,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <Spinner tone={onDark && !isDisabled ? 'light' : 'dark'} size={isLarge ? 18 : 16} />
      ) : icon ? (
        <Icon name={icon} size={isLarge ? 20 : 16} color={labelColor} />
      ) : null}
      <AppText variant={isLarge ? 'button' : 'buttonS'} color={labelColor} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

function surface(variant: ButtonVariant, disabled: boolean) {
  if (variant === 'ghost') return null;
  if (disabled) return styles.disabled;
  return styles[variant];
}

/** Stacks full-width buttons with the design's 8 px gap. */
export function ButtonStack({ children }: { children: ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

/** Two buttons side by side, sharing the width. */
export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radius.full,
  },
  large: { height: 52, paddingHorizontal: space[6] },
  small: { height: 36, paddingHorizontal: space[4] },
  block: { alignSelf: 'stretch' },
  primary: { backgroundColor: palette.primary.default },
  secondary: {
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  destructive: { backgroundColor: palette.danger.strong },
  disabled: { backgroundColor: palette.bg.surfaceStrong },
  pressed: { opacity: 0.85 },
  stack: { alignSelf: 'stretch', gap: space[2] },
  row: { flexDirection: 'row', gap: space[2], alignSelf: 'stretch' },
});
