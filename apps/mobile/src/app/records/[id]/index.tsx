import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RecordHero } from '@/components/care-cards';
import { NotFound } from '@/components/not-found';
import { AppText } from '@/components/ui/app-text';
import { KindTag, StatusBadge, TypeTag } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { Card, DetailCard, ListItem } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { AttachmentRow } from '@/components/ui/uploaders';
import { attachmentDetail } from '@/lib/attachments';
import { formatDate, formatDayMonthShort } from '@/lib/format';
import { useStore } from '@/lib/store';
import { color as palette } from '@/theme/tokens';

/** Figma: 30 Health Diary / Medical detail (Active, Voided) and Void record. MR-04. */
export default function MedicalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useStore();
  const toast = useToast();
  const [sheet, setSheet] = useState<'menu' | 'void' | null>(null);
  const [reason, setReason] = useState('');
  const record = state.medical.find((r) => r.id === id);
  if (!record) return <NotFound title="Medical record" />;

  const pet = state.pets.find((p) => p.id === record.petId);
  const visit = state.visits.find((v) => v.id === record.linkedVisitId);
  const voided = Boolean(record.voidedOn);

  return (
    <StackScreen
      header={
        <DetailHeader
          title="Medical record"
          action={
            voided
              ? undefined
              : { icon: 'more-horizontal', label: 'More actions', onPress: () => setSheet('menu') }
          }
        />
      }
    >
      {voided ? (
        <Banner
          tone="neutral"
          title={`Voided on ${formatDate(record.voidedOn as string)}`}
          body={`Reason: ${record.voidReason} Voided records stay in history but leave care summaries.`}
        />
      ) : null}
      <RecordHero
        tint={palette.kind.medical}
        muted={voided}
        tags={
          <>
            {voided ? <StatusBadge status="voided" /> : <KindTag kind="medical" />}
            <TypeTag label="Entered by you" />
          </>
        }
        overline={record.type}
        title={record.title}
        meta={[
          { icon: 'calendar', label: formatDate(record.date) },
          ...(record.provider ? [{ icon: 'stethoscope' as const, label: record.provider }] : []),
        ]}
      />
      {record.notes && !voided ? (
        <Card padded="content">
          <AppText variant="label" color={palette.text.secondary}>
            Notes
          </AppText>
          <AppText variant="bodyM">{record.notes}</AppText>
        </Card>
      ) : null}
      <DetailCard
        rows={[
          ['Pet', pet?.name ?? '—'],
          ['Linked visit', visit ? `${visit.title} · ${formatDayMonthShort(visit.date)}` : 'None'],
          ['Last edited', formatDate(record.editedOn)],
        ]}
      />
      <SectionHeader
        title={`Files · ${record.attachments.length}`}
        actionLabel={voided ? undefined : 'Manage'}
        onActionPress={() => router.push(`/records/${record.id}/files`)}
      />
      {record.attachments.length === 0 ? (
        <AppText variant="bodyM" color={palette.text.secondary}>
          No files attached.
        </AppText>
      ) : null}
      {record.attachments.map((a) => (
        <AttachmentRow
          key={a.id}
          name={a.name}
          detail={attachmentDetail(a)}
          state={a.state}
          onOpen={() => router.push(`/records/${record.id}/file/${a.id}`)}
          onRemove={() => actions.removeAttachment(record.id, a.id)}
          onRetry={() => router.push(`/records/${record.id}/files`)}
        />
      ))}

      <BottomSheet visible={sheet === 'menu'} title={record.title} onClose={() => setSheet(null)}>
        <ListItem
          title="Edit record"
          icon="pencil"
          onPress={() => {
            setSheet(null);
            router.push(`/records/${record.id}/edit`);
          }}
        />
        <ListItem
          title="Manage files"
          icon="paperclip"
          onPress={() => {
            setSheet(null);
            router.push(`/records/${record.id}/files`);
          }}
        />
        <ListItem
          title="Void record"
          subtitle="Keeps it in history with a reason"
          icon="archive"
          onPress={() => setSheet('void')}
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'void'}
        title="Void this record?"
        onClose={() => setSheet(null)}
      >
        <AppText variant="bodyM" color={palette.text.secondary}>
          It leaves the timeline and care summaries but stays in history. Pending reminders from it
          are canceled.
        </AppText>
        <Textarea
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Entered for the wrong pet"
          maxLength={500}
        />
        <Button
          label="Void record"
          variant="destructive"
          block
          disabled={!reason.trim()}
          onPress={() => {
            actions.voidMedical(record.id, reason.trim());
            setSheet(null);
            toast.show('Record voided');
          }}
        />
        <Button label="Cancel" variant="ghost" block onPress={() => setSheet(null)} />
      </BottomSheet>
    </StackScreen>
  );
}
