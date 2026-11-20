import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import { color as palette, type as typeScale, type TypeVariant } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  /** One of the PawCare/* text styles from Figma. */
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

/** Text in a PawCare text style. Respects the system font scale (scalable text). */
export function AppText({
  variant = 'bodyM',
  color = palette.text.primary,
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        typeScale[variant],
        { color },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  // Android adds extra font padding by default, which pushes Lexend off the Figma metrics.
  base: Platform.select({ android: { includeFontPadding: false }, default: {} }),
});
