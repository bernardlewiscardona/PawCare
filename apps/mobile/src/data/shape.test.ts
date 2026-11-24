import { describe, expect, it } from 'vitest';
import { NOT_ALLOWED, asRecord, rejectUnknown } from './shape';

describe('shape helpers', () => {
  it('turns non-objects into an empty record', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord('x')).toEqual({});
    expect(asRecord([1])).toEqual({});
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it('flags keys that are not allowed', () => {
    const errors: Record<string, string[]> = {};
    rejectUnknown({ a: 1, b: 2 }, ['a'], errors);
    expect(errors).toEqual({ b: [NOT_ALLOWED] });
  });
});
