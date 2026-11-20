import { describe, expect, it } from 'vitest';
import {
  batchState,
  consumptionOrder,
  doseStatus,
  dosesOn,
  openVaccineDues,
  prescriptionState,
  scheduledDoseCount,
  supplyStats,
  visitDisplayStatus,
} from './derive';
import { formatAge, formatSignedQuantity, formatTimeRange, parseQuantity } from './format';
import type { Prescription, Supply, Vaccine, Visit } from './types';

const now = { date: '2026-11-10', time: '09:41' };

const visit = (patch: Partial<Visit>): Visit => ({
  id: 'v',
  petId: 'p',
  title: 't',
  provider: 'c',
  date: '2026-11-19',
  start: '10:30',
  end: '11:00',
  timeZone: 'Asia/Manila',
  status: 'planned',
  ...patch,
});

describe('visitDisplayStatus (AP-02)', () => {
  it('keeps future planned visits planned', () => {
    expect(visitDisplayStatus(visit({}), now)).toBe('planned');
  });
  it('turns a passed planned visit into Needs update, never Completed', () => {
    expect(visitDisplayStatus(visit({ date: '2026-11-09' }), now)).toBe('needs-update');
    expect(visitDisplayStatus(visit({ date: '2026-11-10', start: '09:41' }), now)).toBe(
      'needs-update',
    );
  });
  it('shows recorded outcomes as they are', () => {
    expect(visitDisplayStatus(visit({ date: '2026-10-01', status: 'missed' }), now)).toBe('missed');
  });
});

const rx: Prescription = {
  id: 'rx',
  petId: 'p',
  medication: 'Amoxicillin 50 mg',
  instructions: '1 tablet twice daily',
  startDate: '2026-11-05',
  endDate: '2026-11-15',
  mode: 'fixed',
  times: ['20:00', '08:00'],
  timeZone: 'Asia/Manila',
};

describe('prescriptions and doses (VC-02, VC-03)', () => {
  it('derives the lifecycle from dates unless stopped', () => {
    expect(prescriptionState(rx, '2026-11-10')).toBe('active');
    expect(prescriptionState(rx, '2026-11-16')).toBe('ended');
    expect(prescriptionState(rx, '2026-11-01')).toBe('upcoming');
    expect(prescriptionState({ ...rx, stoppedOn: '2026-11-08' }, '2026-11-10')).toBe('stopped');
  });

  it('marks a dose overdue only after its time and while unlogged', () => {
    expect(doseStatus('2026-11-10', '20:00', undefined, now)).toBe('upcoming');
    expect(doseStatus('2026-11-10', '09:00', undefined, now)).toBe('due');
    expect(doseStatus('2026-11-10', '08:00', undefined, now)).toBe('overdue');
    expect(
      doseStatus(
        '2026-11-10',
        '08:00',
        { id: 'l', prescriptionId: 'rx', date: '2026-11-10', time: '08:00', status: 'taken' },
        now,
      ),
    ).toBe('taken');
  });

  it('lists the day’s fixed times in order and none for as-needed', () => {
    expect(dosesOn(rx, [], '2026-11-10', now).map((d) => d.time)).toEqual(['08:00', '20:00']);
    expect(dosesOn({ ...rx, mode: 'asNeeded', times: [] }, [], '2026-11-10', now)).toEqual([]);
    expect(dosesOn(rx, [], '2026-11-20', now)).toEqual([]);
    expect(scheduledDoseCount(rx)).toBe(22);
  });
});

describe('openVaccineDues (VC-04)', () => {
  const v = (patch: Partial<Vaccine>): Vaccine => ({
    id: 'a',
    petId: 'p',
    name: 'DHPPiL',
    givenOn: '2025-11-12',
    nextDueOn: '2026-11-12',
    fulfils: [],
    attachments: [],
    ...patch,
  });
  it('closes a due item only when a later shot explicitly fulfils it', () => {
    expect(openVaccineDues([v({})], 'p').map((x) => x.id)).toEqual(['a']);
    expect(
      openVaccineDues(
        [v({}), v({ id: 'b', givenOn: '2026-11-10', nextDueOn: '2027-11-10', fulfils: ['a'] })],
        'p',
      ).map((x) => x.id),
    ).toEqual(['b']);
  });
  it('never matches by name and ignores voided records', () => {
    expect(
      openVaccineDues(
        [v({}), v({ id: 'b', givenOn: '2026-11-10', nextDueOn: undefined })],
        'p',
      ).map((x) => x.id),
    ).toEqual(['a']);
    expect(openVaccineDues([v({ voidedOn: '2026-11-01' })], 'p')).toEqual([]);
  });
});

describe('supply balances (IN-02, IN-04)', () => {
  const supply: Supply = {
    id: 's',
    name: 'Heartworm chews',
    category: 'Medication',
    unit: 'piece',
    illustration: 'bone',
    petIds: [],
    alertAt: 2,
    expiryLeadDays: 30,
    batches: [
      { id: 'b1', label: 'HW-0926', expiresOn: '2027-09-30', quantity: 1 },
      { id: 'b2', label: 'HW-0326', expiresOn: '2026-10-31', quantity: 1 },
      { id: 'b3', label: 'none', quantity: 0 },
    ],
    ledger: [],
  };

  it('counts expired stock as physical but not usable', () => {
    expect(supplyStats(supply, '2026-11-10')).toMatchObject({
      physical: 2,
      usable: 1,
      alert: 'low-stock',
    });
  });

  it('expires a batch at the start of the day after its date', () => {
    expect(
      batchState({ id: 'x', label: 'x', expiresOn: '2026-11-10', quantity: 1 }, 30, '2026-11-10'),
    ).toBe('expiring');
    expect(
      batchState({ id: 'x', label: 'x', expiresOn: '2026-11-09', quantity: 1 }, 30, '2026-11-10'),
    ).toBe('expired');
    expect(batchState({ id: 'x', label: 'x', quantity: 1 }, 30, '2026-11-10')).toBe(
      'unknown-expiry',
    );
  });

  it('uses the earliest-expiring usable batch first, unknown expiry last', () => {
    const order = consumptionOrder(
      [
        { id: 'u', label: 'u', quantity: 1 },
        { id: 'late', label: 'l', expiresOn: '2027-12-01', quantity: 1 },
        { id: 'soon', label: 's', expiresOn: '2027-01-01', quantity: 1 },
        { id: 'gone', label: 'g', expiresOn: '2026-01-01', quantity: 1 },
      ],
      '2026-11-10',
    );
    expect(order.map((b) => b.id)).toEqual(['soon', 'late', 'u']);
  });
});

describe('quantities, ages and times', () => {
  it('rejects excess precision and fractional discrete units instead of rounding', () => {
    expect(parseQuantity('2.5', 'tablet').error).toBe('Tablets are counted in whole numbers.');
    expect(parseQuantity('1.2345', 'kg').error).toBe('Use up to 3 decimal places.');
    expect(parseQuantity('0', 'g').error).toBe('Enter a quantity above 0.');
    expect(parseQuantity('0', 'g', { allowZero: true }).value).toBe(0);
    expect(parseQuantity('3.25', 'kg').value).toBe(3.25);
  });

  it('formats signed ledger quantities with a true minus sign', () => {
    expect(formatSignedQuantity(-1, 'tablet')).toBe('−1 tablet');
    expect(formatSignedQuantity(14, 'tablet')).toBe('+14 tablets');
  });

  it('shows estimated ages in whole years and unknown births as Unknown', () => {
    expect(formatAge('2024-03-14', false, '2026-11-10')).toBe('2 yrs 7 mo');
    expect(formatAge('2022-01-01', true, '2026-11-10')).toBe('about 4 yrs');
    expect(formatAge('2026-05-01', false, '2026-11-10')).toBe('6 mo');
    expect(formatAge(undefined, false, '2026-11-10')).toBe('Unknown');
  });

  it('formats time ranges across the period boundary', () => {
    expect(formatTimeRange('10:30', '11:00')).toBe('10:30–11:00 AM');
    expect(formatTimeRange('11:30', '12:30')).toBe('11:30 AM–12:30 PM');
  });
});
