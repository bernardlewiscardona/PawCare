import { describe, expect, it } from 'vitest';
import { doseBadge, vaccineDueState } from './care-status';

describe('vaccineDueState', () => {
  const today = '2026-11-10';

  it('marks a past due date Overdue with how long ago it was due', () => {
    expect(vaccineDueState('2026-11-02', today)).toEqual({
      status: 'overdue',
      label: 'Overdue',
      detail: 'Was due Mon, 2 Nov · 8 days ago',
    });
  });

  it('marks today as due, not overdue', () => {
    expect(vaccineDueState('2026-11-10', today)).toMatchObject({
      status: 'due',
      label: 'Due today',
    });
  });

  it('marks dates inside the 30-day window as due soon', () => {
    expect(vaccineDueState('2026-11-12', today)).toEqual({
      status: 'due-soon',
      label: 'Due soon',
      detail: 'Due Thu, 12 Nov · in 2 days',
    });
    expect(vaccineDueState('2026-12-10', today).status).toBe('due-soon');
  });

  it('leaves dates beyond the window as upcoming', () => {
    expect(vaccineDueState('2026-12-11', today).status).toBe('upcoming');
  });
});

describe('doseBadge', () => {
  it('labels every dose status in text, not colour alone', () => {
    expect(doseBadge('taken')).toEqual({ status: 'taken', label: 'Taken' });
    expect(doseBadge('skipped')).toEqual({ status: 'skipped', label: 'Skipped' });
    expect(doseBadge('due')).toEqual({ status: 'due-now', label: 'Due now' });
    expect(doseBadge('overdue')).toEqual({ status: 'overdue', label: 'Overdue' });
    expect(doseBadge('upcoming')).toEqual({ status: 'upcoming', label: 'Upcoming' });
  });
});
