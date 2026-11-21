import { describe, expect, it } from 'vitest';
import { isRepeatedPush } from './navigation';

const stack = (...routes: { name: string; params?: object }[]) => ({
  index: routes.length - 1,
  routes,
});
const push = (name: string, params?: object) => ({
  type: 'PUSH',
  payload: { name, params, path: '/x' },
});

describe('isRepeatedPush', () => {
  const onVisit = stack({ name: '(tabs)' }, { name: 'visits/[id]/index', params: { id: 'v1' } });

  it('catches a second push of the screen already on top (a double tap)', () => {
    expect(isRepeatedPush(onVisit, push('visits/[id]/index', { id: 'v1' }))).toBe(true);
    expect(isRepeatedPush(stack({ name: 'visits/new' }), push('visits/new', {}))).toBe(true);
  });

  it('lets a push to another record of the same type through', () => {
    expect(isRepeatedPush(onVisit, push('visits/[id]/index', { id: 'v2' }))).toBe(false);
  });

  it('lets a push to a different screen through', () => {
    expect(isRepeatedPush(onVisit, push('visits/[id]/edit', { id: 'v1' }))).toBe(false);
  });

  it('only compares with the top, so a screen deeper in the stack can be pushed again', () => {
    const deeper = stack(
      { name: '(tabs)' },
      { name: 'vaccines/[id]/index', params: { id: 'a' } },
      { name: 'vaccines/[id]/index', params: { id: 'b' } },
    );
    expect(isRepeatedPush(deeper, push('vaccines/[id]/index', { id: 'a' }))).toBe(false);
  });

  it('ignores Expo Router’s internal params, undefined values and key order', () => {
    const top = stack({ name: 'records/new', params: { visit: 'v1', pet: 'p1' } });
    expect(
      isRepeatedPush(
        top,
        push('records/new', { pet: 'p1', visit: 'v1', extra: undefined, __internalFlag: true }),
      ),
    ).toBe(true);
    expect(isRepeatedPush(stack({ name: 'pets/new' }), push('pets/new', undefined))).toBe(true);
  });

  it('never blocks other actions, such as replace or back', () => {
    expect(
      isRepeatedPush(onVisit, {
        type: 'REPLACE',
        payload: { name: 'visits/[id]/index', params: { id: 'v1' } },
      }),
    ).toBe(false);
    expect(isRepeatedPush(onVisit, { type: 'GO_BACK' })).toBe(false);
  });
});
