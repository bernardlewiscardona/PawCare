import { Pressable, StyleSheet, View } from 'react-native';
import { color as palette, radius, space } from '@/theme/tokens';
import { AppText } from './app-text';
import { Avatar, type AvatarKey } from './avatar';
import { StatusBadge } from './badges';
import { ProgressBar } from './feedback';
import { Icon, type IconName } from './icon';
import { IconButton } from './icon-button';

/** Figma "Image Uploader": circular pet photo / owner avatar with a camera or add badge. */
export function ImageUploader({
  avatar,
  size = 104,
  label,
  onPress,
}: {
  avatar?: AvatarKey;
  size?: number;
  label: string;
  onPress: () => void;
}) {
  const circle = size - 8;
  const badge = Math.round(size * 0.33);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: size, height: size }}
    >
      {avatar ? (
        <Avatar avatar={avatar} size={circle} />
      ) : (
        <View
          style={[styles.placeholder, { width: circle, height: circle, borderRadius: circle / 2 }]}
        >
          <Icon name="camera" size={Math.round(circle * 0.29)} color={palette.text.secondary} />
        </View>
      )}
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
        <Icon
          name={avatar ? 'camera' : 'plus'}
          size={Math.round(badge * 0.47)}
          color={palette.text.inverse}
        />
      </View>
    </Pressable>
  );
}

/** Figma "File Uploader": attachments on medical, vaccine and prescription records; max 5. */
export function FileUploader({
  count,
  limit = 5,
  hint = 'PDF, JPG, PNG or HEIC · up to 10 MB each',
  onPress,
}: {
  count: number;
  limit?: number;
  hint?: string;
  onPress: () => void;
}) {
  const full = count >= limit;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        full
          ? `${limit} of ${limit} files attached. Remove a file to add another.`
          : `Add files. ${count} of ${limit} attached.`
      }
      accessibilityState={{ disabled: full }}
      disabled={full}
      onPress={onPress}
      style={styles.uploader}
    >
      <View style={styles.uploadIcon}>
        <Icon
          name={full ? 'paperclip' : 'upload'}
          size={20}
          color={full ? palette.text.secondary : palette.text.primary}
        />
      </View>
      <AppText
        variant="titleS"
        align="center"
        color={full ? palette.text.secondary : palette.text.primary}
      >
        {full ? `${limit} of ${limit} files attached` : 'Add files'}
      </AppText>
      <AppText variant="caption" color={palette.text.secondary} align="center">
        {full ? 'Remove a file to add another.' : hint}
      </AppText>
      <AppText variant="caption" color={palette.text.secondary} align="center">
        {full ? `Limit: ${limit} per record` : `${count} of ${limit} attached`}
      </AppText>
    </Pressable>
  );
}

export type AttachmentState = 'uploading' | 'scanning' | 'attached' | 'rejected' | 'failed';

type AttachmentRowProps = {
  name: string;
  detail: string;
  state: AttachmentState;
  progress?: number;
  onOpen?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
};

/**
 * Figma "Attachment Row": scanning files cannot be opened; rejected and failed offer remove or
 * retry. Only Attached files expose an open action.
 */
export function AttachmentRow({
  name,
  detail,
  state,
  progress = 0,
  onOpen,
  onRemove,
  onRetry,
  onCancel,
}: AttachmentRowProps) {
  const bad = state === 'rejected' || state === 'failed';
  const action: { icon: IconName; label: string; onPress?: () => void } | null =
    state === 'attached'
      ? { icon: 'eye', label: `Open ${name}`, onPress: onOpen }
      : state === 'uploading'
        ? { icon: 'x', label: `Cancel upload of ${name}`, onPress: onCancel }
        : state === 'rejected'
          ? { icon: 'trash', label: `Remove ${name}`, onPress: onRemove }
          : state === 'failed'
            ? { icon: 'rotate-cw', label: `Retry ${name}`, onPress: onRetry }
            : null;
  return (
    <View style={styles.row}>
      <View
        style={[styles.file, { backgroundColor: bad ? palette.danger.subtle : palette.bg.screen }]}
      >
        <Icon
          name="file-text"
          size={20}
          color={bad ? palette.danger.strong : palette.text.primary}
        />
      </View>
      <View style={styles.text}>
        <AppText variant="label" numberOfLines={2}>
          {name}
        </AppText>
        {state === 'uploading' ? <ProgressBar value={progress} /> : null}
        <AppText variant="caption" color={bad ? palette.text.danger : palette.text.secondary}>
          {detail}
        </AppText>
      </View>
      {state === 'scanning' ? <StatusBadge status="scanning" /> : null}
      {bad ? <StatusBadge status={state} /> : null}
      {action ? (
        <IconButton
          icon={action.icon}
          variant="ghost"
          size={32}
          accessibilityLabel={action.label}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.border.default,
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg.inverse,
    borderWidth: 2,
    borderColor: palette.text.inverse,
  },
  uploader: {
    alignItems: 'center',
    gap: space[1] + 2,
    paddingVertical: space[6],
    paddingHorizontal: space[5],
    borderRadius: radius.xl,
    backgroundColor: palette.bg.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.border.default,
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg.screen,
    marginBottom: space[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
  },
  file: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space[1] },
});
