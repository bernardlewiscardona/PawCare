import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { color as palette, radius } from '@/theme/tokens';
import { Icon, type IconName } from './icon';

export type IconButtonVariant = 'outline' | 'surface' | 'ghost' | 'inverse';

type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Required: icon-only controls must be named for screen readers. */
  accessibilityLabel: string;
  /** Figma "Icon Button" Style: Outline in headers, Surface on white, Ghost inline, Inverse on tints. */
  variant?: IconButtonVariant;
  /** Medium 40, Small 32. */
  size?: 40 | 32;
  iconColor?: string;
};

export function IconButton({
  icon,
  variant = 'outline',
  size = 40,
  iconColor,
  disabled,
  ...rest
}: IconButtonProps) {
  const tint = iconColor ?? (variant === 'inverse' ? palette.text.inverse : palette.text.primary);
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={size === 32 ? 8 : 4}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={size === 40 ? 20 : 16} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  outline: {
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  surface: { backgroundColor: palette.bg.surface },
  ghost: {},
  inverse: { backgroundColor: palette.bg.inverse },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
