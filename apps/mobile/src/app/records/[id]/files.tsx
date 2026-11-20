import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { NotFound } from '@/components/not-found';
import { AppText } from '@/components/ui/app-text';
import { IconTile } from '@/components/ui/badges';
import { useToast } from '@/components/ui/feedback';
import { ModalHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { AttachmentRow, FileUploader } from '@/components/ui/uploaders';
import { attachmentDetail, FILE_LIMIT } from '@/lib/attachments';
import { formatDate } from '@/lib/format';
import { useStore } from '@/lib/store';
import { color as palette, radius, space } from '@/theme/tokens';

/**
 * Figma: 30 Health Diary / Attachments (Uploading and scanning, Rejected and failed, Limit
 * reached). MR-02: files link only after type validation and a malware scan; scanning files
 * can't be opened. TODO(storage): real uploads arrive with object storage + scanning.
 */
export default function RecordFilesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useStore();
  const toast = useToast();
  const record = state.medical.find((r) => r.id === id && !r.voidedOn);
  if (!record) return <NotFound title="Files" />;

  const retry = (attachmentId: string) => {
    actions.setAttachmentState(record.id, attachmentId, 'scanning');
    // Stand-in for the scan result.
    setTimeout(() => actions.setAttachmentState(record.id, attachmentId, 'attached'), 1800);
  };

  return (
    <StackScreen
      header={
        <ModalHeader title="Medical record" actionLabel="Done" onAction={() => router.back()} />
      }
      gap={space[2] + 2}
    >
      <View style={styles.summary}>
        <IconTile illustration="first-aid" />
        <View style={styles.grow}>
          <AppText variant="titleS">{record.title}</AppText>
          <AppText variant="caption" color={palette.text.secondary}>
            Medical · {formatDate(record.date)} · saved
          </AppText>
        </View>
      </View>
      <SectionHeader title="Files" />
      {record.attachments.map((a) => (
        <AttachmentRow
          key={a.id}
          name={a.name}
          detail={attachmentDetail(a)}
          state={a.state}
          onOpen={() => router.push(`/records/${record.id}/file/${a.id}`)}
          onRemove={() => actions.removeAttachment(record.id, a.id)}
          onRetry={() => retry(a.id)}
          onCancel={() => actions.removeAttachment(record.id, a.id)}
        />
      ))}
      <FileUploader
        count={record.attachments.length}
        limit={FILE_LIMIT}
        onPress={() => toast.show('File upload arrives with file storage.', 'info')}
      />
      <AppText variant="caption" color={palette.text.secondary}>
        The record is saved even if a file fails. Retry or remove it any time.
      </AppText>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: 2 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.xl,
    backgroundColor: palette.bg.surface,
  },
});
