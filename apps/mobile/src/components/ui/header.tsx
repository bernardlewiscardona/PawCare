import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color as palette, space } from '@/theme/tokens';
import { AppText } from './app-text';
import type { IconName } from './icon';
import { IconButton } from './icon-button';

type Action = { icon: IconName; label: string; onPress: () => void };

/** Figma "Header" Root: large title with up to two actions (outline, then inverse). */
export function RootHeader({ title, actions = [] }: { title: string; actions?: Action[] }) {
  return (
    <View style={styles.header}>
      <AppText variant="titleL" accessibilityRole="header" style={styles.grow}>
        {title}
      </AppText>
      {actions.map((a) => (
        <IconButton
          key={a.label}
          icon={a.icon}
          variant={a.icon === 'plus' ? 'inverse' : 'outline'}
          accessibilityLabel={a.label}
          onPress={a.onPress}
        />
      ))}
    </View>
  );
}

/** Figma "Header" Detail: back, centred title, optional overflow/action. */
export function DetailHeader({
  title,
  action,
  onBack = () => router.back(),
}: {
  title: string;
  action?: Action;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={onBack} />
      <AppText
        variant="titleS"
        align="center"
        numberOfLines={1}
        accessibilityRole="header"
        style={styles.grow}
      >
        {title}
      </AppText>
      {action ? (
        <IconButton icon={action.icon} accessibilityLabel={action.label} onPress={action.onPress} />
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

/** Figma "Header" Modal: close, centred title, text action (Save). */
export function ModalHeader({
  title,
  actionLabel = 'Save',
  onAction,
  actionDisabled = false,
  onClose = () => router.back(),
  trailing,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onClose?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <IconButton icon="x" variant="surface" accessibilityLabel="Close" onPress={onClose} />
      <AppText
        variant="titleS"
        align="center"
        numberOfLines={1}
        accessibilityRole="header"
        style={styles.grow}
      >
        {title}
      </AppText>
      {trailing ??
        (onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: actionDisabled }}
            disabled={actionDisabled}
            onPress={onAction}
            hitSlop={12}
            style={styles.textAction}
          >
            <AppText
              variant="buttonS"
              color={actionDisabled ? palette.text.secondary : palette.text.primary}
            >
              {actionLabel}
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[1] + 2,
    paddingHorizontal: space[5],
  },
  grow: { flex: 1 },
  spacer: { width: 40 },
  textAction: { minWidth: 40, alignItems: 'flex-end' },
});
