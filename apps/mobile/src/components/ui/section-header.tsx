import { Pressable, StyleSheet, View } from 'react-native';
import { color as palette, space } from '@/theme/tokens';
import { AppText } from './app-text';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  /** Large = Title L, Small = Title M (Figma "Section Header" Size). */
  size?: 'large' | 'small';
};

/** Figma "Section Header": block title with an optional quiet text action. */
export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  size = 'small',
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText
        variant={size === 'large' ? 'titleL' : 'titleM'}
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </AppText>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          hitSlop={12}
        >
          <AppText variant="bodyM" color={palette.text.secondary}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { flex: 1 },
});
