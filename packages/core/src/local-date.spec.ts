import { localDate } from './local-date.js';

describe('localDate', () => {
  const instant = new Date('2026-11-23T17:30:00Z');

  it("gives the calendar date in the owner's zone", () => {
    expect(localDate('Asia/Manila', instant)).toBe('2026-11-24');
    expect(localDate('UTC', instant)).toBe('2026-11-23');
    expect(localDate('America/Los_Angeles', instant)).toBe('2026-11-23');
  });
});
