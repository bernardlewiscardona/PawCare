import type { NativeStackNavigatorProps } from 'expo-router';

type RouteLike = { name: string; params?: object };
type StackLike = { index: number; routes: readonly RouteLike[] };
type ActionLike = { type: string; payload?: unknown };

/** Route params without Expo Router's internal markers, as stable JSON. */
function paramsKey(params: unknown): string {
  const entries = Object.entries(params && typeof params === 'object' ? params : {})
    .filter(([key, value]) => !key.startsWith('__') && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * True when `action` pushes exactly the screen already on top (same route, same params). A fast
 * double tap on a row or a "+" sends two identical pushes before the first screen appears.
 */
export function isRepeatedPush(state: StackLike, action: ActionLike): boolean {
  if (action.type !== 'PUSH') return false;
  const payload = action.payload as { name?: unknown; params?: unknown } | undefined;
  const top = state.routes[state.index];
  return (
    top !== undefined &&
    payload?.name === top.name &&
    paramsKey(payload.params) === paramsKey(top.params)
  );
}

/**
 * Root stack router override: a push of the screen that is already on top is handled as a no-op,
 * so a double tap never stacks two copies. Everything else goes to Expo Router's own router,
 * including pushes to another screen of the same type (one vaccine to another).
 *
 * `UNSTABLE_router` is React Navigation's documented hook for this; an SDK that removes it will
 * fail the typecheck here.
 */
export const ignoreRepeatedPush: NonNullable<NativeStackNavigatorProps['UNSTABLE_router']> = (
  original,
) => ({
  getStateForAction(state, action, options) {
    if (isRepeatedPush(state, action)) {
      return { state, affectedRouteKey: state.routes[state.index]?.key };
    }
    return original.getStateForAction(state, action, options);
  },
});
