/**
 * DEMO STORE — in-memory state so every designed flow works end to end before the API exists.
 * Mutations here stand in for API calls; each one maps to a story (noted inline). Nothing is
 * persisted, and nothing here may cross a guardrail: logging a dose never touches stock,
 * reminders never complete care, and corrections archive/void instead of deleting.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { round, type Now } from './derive';
import { createSeed, DEMO_NOW, type DemoState } from './seed';
import type {
  CustomReminder,
  MedicalRecord,
  NotificationPrefs,
  Owner,
  Pet,
  Prescription,
  Supply,
  Vaccine,
  Visit,
} from './types';

type Setter = (fn: (s: DemoState) => DemoState) => void;

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;
const today = DEMO_NOW.date;

function updateIn<T extends { id: string }>(list: T[], id: string, patch: (item: T) => T): T[] {
  return list.map((item) => (item.id === id ? patch(item) : item));
}

function makeActions(set: Setter) {
  return {
    signIn: () => set((s) => ({ ...s, signedIn: true })),
    signOut: () => set((s) => ({ ...s, signedIn: false })),
    /** FN-02 stand-in: wipes the demo account and starts over from the seed. */
    deleteAccount: () => set(() => createSeed()),

    updateOwner: (patch: Partial<Owner>) => set((s) => ({ ...s, owner: { ...s.owner, ...patch } })),
    updatePrefs: (patch: Partial<NotificationPrefs>) =>
      set((s) => ({ ...s, prefs: { ...s.prefs, ...patch } })),

    selectPet: (petId: string) => set((s) => ({ ...s, selectedPetId: petId })),

    // PF-02 / PF-03
    addPet: (data: Omit<Pet, 'id' | 'tint'>) => {
      const id = newId('pet');
      set((s) => ({ ...s, pets: [...s.pets, { ...data, id, tint: 'pink' }], selectedPetId: id }));
      return id;
    },
    updatePet: (id: string, patch: Partial<Pet>) =>
      set((s) => ({ ...s, pets: updateIn(s.pets, id, (p) => ({ ...p, ...patch })) })),
    // PF-04: archive cancels pending reminders; restore keeps them off unless asked.
    archivePet: (id: string) =>
      set((s) => {
        const pets = updateIn(s.pets, id, (p) => ({ ...p, archivedOn: today, remindersOff: true }));
        const nextActive = pets.find((p) => !p.archivedOn);
        return {
          ...s,
          pets,
          selectedPetId: s.selectedPetId === id ? (nextActive?.id ?? '') : s.selectedPetId,
        };
      }),
    restorePet: (id: string, remindersOn: boolean) =>
      set((s) => ({
        ...s,
        pets: updateIn(s.pets, id, (p) => ({
          ...p,
          archivedOn: undefined,
          remindersOff: !remindersOn,
        })),
      })),
    turnOnPetReminders: (id: string) =>
      set((s) => ({ ...s, pets: updateIn(s.pets, id, (p) => ({ ...p, remindersOff: false })) })),

    // MR-01 / MR-02 / MR-04
    addMedical: (data: Omit<MedicalRecord, 'id' | 'editedOn' | 'attachments'>) => {
      const id = newId('med');
      set((s) => ({
        ...s,
        medical: [{ ...data, id, editedOn: today, attachments: [] }, ...s.medical],
      }));
      return id;
    },
    updateMedical: (id: string, patch: Partial<MedicalRecord>) =>
      set((s) => ({
        ...s,
        medical: updateIn(s.medical, id, (r) => ({ ...r, ...patch, editedOn: today })),
      })),
    voidMedical: (id: string, reason: string) =>
      set((s) => ({
        ...s,
        medical: updateIn(s.medical, id, (r) => ({ ...r, voidedOn: today, voidReason: reason })),
      })),
    removeAttachment: (recordId: string, attachmentId: string) =>
      set((s) => ({
        ...s,
        medical: updateIn(s.medical, recordId, (r) => ({
          ...r,
          attachments: r.attachments.filter((a) => a.id !== attachmentId),
        })),
        vaccines: updateIn(s.vaccines, recordId, (r) => ({
          ...r,
          attachments: r.attachments.filter((a) => a.id !== attachmentId),
        })),
      })),
    setAttachmentState: (
      recordId: string,
      attachmentId: string,
      state: 'scanning' | 'attached' | 'failed',
    ) =>
      set((s) => ({
        ...s,
        medical: updateIn(s.medical, recordId, (r) => ({
          ...r,
          attachments: r.attachments.map((a) => (a.id === attachmentId ? { ...a, state } : a)),
        })),
      })),

    // VC-01 / VC-04
    addVaccine: (data: Omit<Vaccine, 'id' | 'attachments'>) => {
      const id = newId('vax');
      set((s) => ({ ...s, vaccines: [{ ...data, id, attachments: [] }, ...s.vaccines] }));
      return id;
    },
    updateVaccine: (id: string, patch: Partial<Vaccine>) =>
      set((s) => ({ ...s, vaccines: updateIn(s.vaccines, id, (v) => ({ ...v, ...patch })) })),
    voidVaccine: (id: string, reason: string) =>
      set((s) => ({
        ...s,
        vaccines: updateIn(s.vaccines, id, (v) => ({ ...v, voidedOn: today, voidReason: reason })),
      })),

    // VC-02 / VC-03
    addPrescription: (data: Omit<Prescription, 'id'>) => {
      const id = newId('rx');
      set((s) => ({ ...s, prescriptions: [{ ...data, id }, ...s.prescriptions] }));
      return id;
    },
    updatePrescription: (id: string, patch: Partial<Prescription>) =>
      set((s) => ({
        ...s,
        prescriptions: updateIn(s.prescriptions, id, (r) => ({ ...r, ...patch })),
      })),
    stopPrescription: (id: string) =>
      set((s) => ({
        ...s,
        prescriptions: updateIn(s.prescriptions, id, (r) => ({ ...r, stoppedOn: today })),
      })),
    /** One current result per occurrence; a correction replaces it (audit lives server-side). */
    logDose: (
      prescriptionId: string,
      date: string,
      time: string,
      status: 'taken' | 'skipped',
      note?: string,
    ) =>
      set((s) => {
        const rest = s.doseLogs.filter(
          (l) => !(l.prescriptionId === prescriptionId && l.date === date && l.time === time),
        );
        return {
          ...s,
          doseLogs: [
            ...rest,
            {
              id: newId('dose'),
              prescriptionId,
              date,
              time,
              status,
              at: DEMO_NOW.time,
              note: note || undefined,
            },
          ],
        };
      }),

    // AP-01 / AP-03 / AP-04 / AP-05
    addVisit: (data: Omit<Visit, 'id' | 'status'>) => {
      const id = newId('visit');
      set((s) => ({ ...s, visits: [...s.visits, { ...data, id, status: 'planned' }] }));
      return id;
    },
    updateVisit: (id: string, patch: Partial<Visit>) =>
      set((s) => ({ ...s, visits: updateIn(s.visits, id, (v) => ({ ...v, ...patch })) })),
    cancelVisit: (id: string, reason?: string) =>
      set((s) => ({
        ...s,
        visits: updateIn(s.visits, id, (v) => ({
          ...v,
          status: 'canceled',
          canceledOn: today,
          cancelReason: reason || undefined,
        })),
      })),
    recordOutcome: (id: string, outcome: 'completed' | 'missed') =>
      set((s) => ({
        ...s,
        visits: updateIn(s.visits, id, (v) => ({ ...v, status: outcome, outcomeOn: today })),
      })),

    // IN-01 … IN-04: immutable ledger; batch balances change only through new entries.
    addSupply: (data: Omit<Supply, 'id' | 'batches' | 'ledger'>) => {
      const id = newId('sup');
      const opening = {
        id: newId('l'),
        type: 'opening' as const,
        date: today,
        detail: 'Today · item created',
        quantity: 0,
      };
      set((s) => ({
        ...s,
        supplies: [{ ...data, id, batches: [], ledger: [opening] }, ...s.supplies],
      }));
      return id;
    },
    restock: (
      id: string,
      quantity: number,
      label: string | undefined,
      expiresOn: string | undefined,
    ) =>
      set((s) => ({
        ...s,
        supplies: updateIn(s.supplies, id, (sup) => {
          const batchId = newId('b');
          const name = label?.trim() || `Restock ${today.slice(5)}`;
          return {
            ...sup,
            batches: [...sup.batches, { id: batchId, label: name, expiresOn, quantity }],
            ledger: [
              {
                id: newId('l'),
                type: 'restocked',
                date: today,
                time: DEMO_NOW.time,
                detail: `Batch ${name}`,
                quantity,
                batchId,
              },
              ...sup.ledger,
            ],
          };
        }),
      })),
    consume: (id: string, batchId: string, quantity: number, detail: string) =>
      applyBatch(set, id, batchId, -quantity, 'used', detail),
    dispose: (id: string, batchId: string, quantity: number, reason: string) =>
      applyBatch(set, id, batchId, -quantity, 'disposed', reason),
    adjust: (id: string, batchId: string, delta: number, reason: string) =>
      applyBatch(set, id, batchId, delta, 'adjusted', reason),
    /** Compensating entry, created once; the original stays in the ledger. */
    reverse: (id: string, entryId: string) =>
      set((s) => ({
        ...s,
        supplies: updateIn(s.supplies, id, (sup) => {
          const entry = sup.ledger.find((l) => l.id === entryId);
          if (!entry || entry.reversedById || !entry.batchId) return sup;
          const reversal = {
            id: newId('l'),
            type: 'reversed' as const,
            date: today,
            time: DEMO_NOW.time,
            detail: `Reverses ${entry.type} on ${entry.date.slice(8)}/${entry.date.slice(5, 7)}`,
            quantity: -entry.quantity,
            batchId: entry.batchId,
          };
          return {
            ...sup,
            batches: sup.batches.map((b) =>
              b.id === entry.batchId ? { ...b, quantity: round(b.quantity - entry.quantity) } : b,
            ),
            ledger: [
              reversal,
              ...sup.ledger.map((l) =>
                l.id === entryId ? { ...l, reversedById: reversal.id } : l,
              ),
            ],
          };
        }),
      })),
    archiveSupply: (id: string) =>
      set((s) => ({
        ...s,
        supplies: updateIn(s.supplies, id, (sup) => ({ ...sup, archivedOn: today })),
      })),

    // RM-04: read state is independent of care; dismiss never changes the source.
    markRead: (id: string) =>
      set((s) => ({
        ...s,
        inbox: updateIn(s.inbox, id, (r) => (r.state === 'unread' ? { ...r, state: 'read' } : r)),
      })),
    dismiss: (id: string) => set((s) => ({ ...s, inbox: s.inbox.filter((r) => r.id !== id) })),

    // RM-03
    addCustomReminder: (data: Omit<CustomReminder, 'id'>) => {
      const id = newId('cr');
      set((s) => ({ ...s, customReminders: [...s.customReminders, { ...data, id }] }));
      return id;
    },
    updateCustomReminder: (id: string, patch: Partial<CustomReminder>) =>
      set((s) => ({
        ...s,
        customReminders: updateIn(s.customReminders, id, (r) => ({ ...r, ...patch })),
      })),
    deleteCustomReminder: (id: string) =>
      set((s) => ({ ...s, customReminders: s.customReminders.filter((r) => r.id !== id) })),
  };
}

function applyBatch(
  set: Setter,
  id: string,
  batchId: string,
  delta: number,
  type: 'used' | 'disposed' | 'adjusted',
  detail: string,
) {
  set((s) => ({
    ...s,
    supplies: updateIn(s.supplies, id, (sup) => ({
      ...sup,
      batches: sup.batches.map((b) =>
        b.id === batchId ? { ...b, quantity: Math.max(0, round(b.quantity + delta)) } : b,
      ),
      ledger: [
        {
          id: newId('l'),
          type,
          date: today,
          time: DEMO_NOW.time,
          detail,
          quantity: delta,
          batchId,
        },
        ...sup.ledger,
      ],
    })),
  }));
}

export type Actions = ReturnType<typeof makeActions>;

type Store = { state: DemoState; now: Now; today: string; actions: Actions };

const StoreContext = createContext<Store | null>(null);

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(createSeed);
  const actions = useMemo(() => makeActions(setState), []);
  const value = useMemo<Store>(
    () => ({ state, now: DEMO_NOW, today: DEMO_NOW.date, actions }),
    [state, actions],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside DemoStoreProvider');
  return value;
}

/** Active (non-archived) pets, the ones selectors may show (PF-04). */
export function useActivePets() {
  const { state } = useStore();
  return state.pets.filter((p) => !p.archivedOn);
}

/** The pet that pet-scoped screens show (PF-03). Falls back to the first active pet. */
export function useSelectedPet() {
  const { state, actions } = useStore();
  const active = state.pets.filter((p) => !p.archivedOn);
  const pet = active.find((p) => p.id === state.selectedPetId) ?? active[0];
  return { pet, selectPet: actions.selectPet };
}
