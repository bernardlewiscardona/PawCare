import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RecordHero, VaccineRow } from '@/components/care-cards';
import { NotFound } from '@/components/not-found';
import { AppText } from '@/components/ui/app-text';
import { KindTag, StatusBadge, TypeTag } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Banner, useToast } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';
import { DetailHeader } from '@/components/ui/header';
import { BottomSheet } from '@/components/ui/overlay';
import { DetailCard, ListItem } from '@/components/ui/rows';
import { StackScreen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { AttachmentRow, FileUploader } from '@/components/ui/uploaders';
import { attachmentDetail } from '@/lib/attachments';
import { vaccineDueState } from '@/lib/care-status';
import { formatDate, formatShortDateYear } from '@/lib/format';
import { useStore } from '@/lib/store';
import { color as palette } from '@/theme/tokens';

/** Figma: 40 Vaccines & Meds / Vaccine detail (Due, Voided) and form Success. VC-01 / VC-04. */
export default function VaccineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, today, actions } = useStore();
  const toast = useToast();
  const [sheet, setSheet] = useState<'menu' | 'void' | null>(null);
  const [reason, setReason] = useState('');
  const vaccine = state.vaccines.find((v) => v.id === id);
  if (!vaccine) return <NotFound title="Vaccine" />;

  const pet = state.pets.find((p) => p.id === vaccine.petId);
  const voided = Boolean(vaccine.voidedOn);
  const fulfilledBy = state.vaccines.find((v) => !v.voidedOn && v.fulfils.includes(vaccine.id));
  const fulfilled = state.vaccines.filter((v) => vaccine.fulfils.includes(v.id));
  const due = vaccine.nextDueOn ? vaccineDueState(vaccine.nextDueOn, today) : undefined;

  return (
    <StackScreen
      header={
        <DetailHeader
          title="Vaccine"
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
          title={`Voided on ${formatDate(vaccine.voidedOn as string)}`}
          body={`Reason: ${vaccine.voidReason} Its due reminders stopped; history is kept.`}
        />
      ) : null}
      <RecordHero
        tint={palette.kind.vaccine}
        muted={voided}
        tags={
          <>
            {voided ? <StatusBadge status="voided" /> : <KindTag kind="vaccine" />}
            <TypeTag label="Entered by you" />
          </>
        }
        title={vaccine.name}
        meta={[
          { icon: 'calendar', label: `Given ${formatDate(vaccine.givenOn)}` },
          ...(vaccine.provider ? [{ icon: 'stethoscope' as const, label: vaccine.provider }] : []),
        ]}
      />
      <DetailCard
        rows={[
          ['Pet', pet?.name ?? '—'],
          ['Batch', vaccine.batch ?? 'Not recorded'],
          ['Provider', vaccine.provider ?? 'Not recorded'],
        ]}
      />
      {!voided ? (
        <>
          <SectionHeader title="Next dose" />
          {!vaccine.nextDueOn ? (
            <AppText variant="bodyM" color={palette.text.secondary}>
              No next date recorded. PawCare doesn’t work out vaccine schedules.
            </AppText>
          ) : fulfilledBy ? (
            <VaccineRow
              name={vaccine.name}
              detail={`Was due ${formatShortDateYear(vaccine.nextDueOn)}`}
              status="fulfilled"
              onPress={() => router.push(`/vaccines/${fulfilledBy.id}`)}
            />
          ) : due && due.status !== 'upcoming' ? (
            <VaccineRow name={vaccine.name} detail={due.detail} status={due.status} />
          ) : (
            <VaccineRow
              name={vaccine.name}
              detail={`Due ${formatDate(vaccine.nextDueOn)} · reminder ${state.prefs.vaccineLeadDays} ${state.prefs.vaccineLeadDays === 1 ? 'day' : 'days'} before`}
            />
          )}
        </>
      ) : null}
      {fulfilled.length ? (
        <>
          <SectionHeader title="Fulfils" />
          {fulfilled.map((v) => (
            <VaccineRow
              key={v.id}
              name={v.name}
              detail={`Was due ${formatShortDateYear(v.nextDueOn as string)}`}
              status="fulfilled"
              onPress={() => router.push(`/vaccines/${v.id}`)}
            />
          ))}
        </>
      ) : null}
      {vaccine.attachments.length ? (
        <>
          <SectionHeader title={`Files · ${vaccine.attachments.length}`} />
          {vaccine.attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              name={a.name}
              detail={attachmentDetail(a)}
              state={a.state}
              onOpen={() => toast.show('Opening files arrives with file storage.', 'info')}
            />
          ))}
        </>
      ) : !voided ? (
        <FileUploader
          count={0}
          hint="Vaccine card or certificate · PDF, JPG, PNG or HEIC"
          onPress={() => toast.show('File upload arrives with file storage.', 'info')}
        />
      ) : null}

      <BottomSheet visible={sheet === 'menu'} title={vaccine.name} onClose={() => setSheet(null)}>
        <ListItem
          title="Edit vaccine"
          icon="pencil"
          onPress={() => {
            setSheet(null);
            router.push(`/vaccines/${vaccine.id}/edit`);
          }}
        />
        <ListItem
          title="Void vaccine"
          subtitle="Keeps it in history with a reason"
          icon="archive"
          onPress={() => setSheet('void')}
        />
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'void'}
        title="Void this vaccine?"
        onClose={() => setSheet(null)}
      >
        <AppText variant="bodyM" color={palette.text.secondary}>
          It leaves care summaries but stays in history. Its pending due reminders are canceled.
        </AppText>
        <Textarea
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Entered twice"
          maxLength={500}
        />
        <Button
          label="Void vaccine"
          variant="destructive"
          block
          disabled={!reason.trim()}
          onPress={() => {
            actions.voidVaccine(vaccine.id, reason.trim());
            setSheet(null);
            toast.show('Vaccine voided');
          }}
        />
        <Button label="Cancel" variant="ghost" block onPress={() => setSheet(null)} />
      </BottomSheet>
    </StackScreen>
  );
}
