/** Longest the splash waits for the database; then the gate's own spinner takes over. */
export const MAX_HOLD_MS = 5000;

/** True while the splash takeover must keep waiting for the database to open. */
export function isHolding(hold: boolean, elapsedMs: number): boolean {
  return hold && elapsedMs < MAX_HOLD_MS;
}
