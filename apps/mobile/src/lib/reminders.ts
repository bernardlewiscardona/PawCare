import { formatShortDate, formatTime12h } from './format';
import type { CustomReminder } from './types';

/** "Mochi · daily at 9:00 PM" or "Kape · once, Sat 14 Nov at 10:00 AM" (RM-03). */
export function scheduleLabel(r: CustomReminder, petName?: string): string {
  const when =
    r.repeat === 'daily'
      ? `daily at ${formatTime12h(r.time)}`
      : `once, ${formatShortDate(r.startDate)} at ${formatTime12h(r.time)}`;
  return [petName, when].filter(Boolean).join(' · ');
}
