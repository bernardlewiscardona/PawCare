import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { NotFound } from '@/components/not-found';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Skeleton, useToast } from '@/components/ui/feedback';
import { DetailHeader } from '@/components/ui/header';
import { StackScreen } from '@/components/ui/screen';
import { formatDate } from '@/lib/format';
import { useStore } from '@/lib/store';
import { color as palette, radius, space } from '@/theme/tokens';

const LINES = [290, 250, 270, 180, 0, 280, 240, 260, 150, 0, 270, 200];

/**
 * Figma: 30 Health Diary / Document viewer. Only scanned, attached files open (MR-02).
 * TODO(storage): render the file from a short-lived (≤5 min) authorised link.
 */
export default function DocumentViewerScreen() {
  const { id, fileId } = useLocalSearchParams<{ id: string; fileId: string }>();
  const { state } = useStore();
  const toast = useToast();
  const record = state.medical.find((r) => r.id === id);
  const file = record?.attachments.find((a) => a.id === fileId && a.state === 'attached');
  if (!record || !file) return <NotFound title="File" />;
  const pet = state.pets.find((p) => p.id === record.petId);
  const download = () => toast.show('Downloads arrive with file storage.', 'info');

  return (
    <StackScreen
      background={palette.bg.surface}
      header={
        <DetailHeader
          title={file.name}
          action={{ icon: 'download', label: `Download ${file.name}`, onPress: download }}
        />
      }
      gap={space[3]}
      bottomBar={
        <Button label="Download" icon="download" variant="secondary" block onPress={download} />
      }
    >
      <View style={styles.page} accessible accessibilityLabel={`Preview of ${file.name}`}>
        <AppText variant="titleS">{record.provider ?? record.title}</AppText>
        <AppText variant="caption" color={palette.text.secondary}>
          {record.title} · {formatDate(record.date)} · Patient: {pet?.name}
        </AppText>
        {LINES.map((w, i) =>
          w ? (
            <Skeleton key={i} shape="line" width={w} height={8} />
          ) : (
            <View key={i} style={styles.gap} />
          ),
        )}
      </View>
      <AppText variant="caption" color={palette.text.secondary} align="center">
        {file.format} · {file.size} · uploaded{' '}
        {file.uploadedOn ? formatDate(file.uploadedOn) : 'recently'} · scanned and safe to open
      </AppText>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: space[2] + 2,
    paddingVertical: space[6] + 4,
    paddingHorizontal: space[6],
    borderRadius: radius.sm,
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
    overflow: 'hidden',
  },
  gap: { height: 8 },
});
