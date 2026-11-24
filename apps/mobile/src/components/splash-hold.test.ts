import { describe, expect, it } from 'vitest';
import { MAX_HOLD_MS, isHolding } from './splash-hold';

describe('isHolding', () => {
  it('lets the takeover start when there is no hold (logo loaded)', () => {
    expect(isHolding(false, 0)).toBe(false);
  });
  it('waits while held before the limit', () => {
    expect(isHolding(true, MAX_HOLD_MS - 1)).toBe(true);
  });
  it('starts anyway once the limit is reached', () => {
    expect(isHolding(true, MAX_HOLD_MS)).toBe(false);
  });
});
