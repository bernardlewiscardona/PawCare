import { useIsFocused, usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Dialog } from '@/components/ui/overlay';

/**
 * Unsaved input is never thrown away silently. While a form's values differ from what it opened
 * with, leaving it (the close button, Android back, or swiping a task down on iOS) asks
 * "Discard changes?" first; forms without changes close freely.
 *
 * Saving (or deleting) is deliberate, so it navigates through `leave`, which skips the question.
 * Pass only what the user enters; values must be plain data (compared as JSON).
 *
 * The guard only holds while the form is focused, so flows that clear the whole stack from a
 * screen above it (account deletion) aren't blocked by a form hidden underneath.
 */
export function useDiscardGuard(values: Record<string, unknown>, recordLabel: string) {
  const [initial] = useState(() => JSON.stringify(values));
  const dirty = JSON.stringify(values) !== initial;
  const focused = useIsFocused();
  const [released, setReleased] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const allowLeave = usePreventRemove(dirty && focused && !released, ({ repeat }) =>
    setPending(() => repeat),
  );

  return {
    /** Navigate away without asking (after a save or a delete). */
    leave: (navigate: () => void) => {
      setReleased(true);
      allowLeave();
      navigate();
    },
    dialog: (
      <Dialog
        visible={pending !== null}
        tone="destructive"
        illustration="report"
        title="Discard changes?"
        body={`You haven’t saved this ${recordLabel}. Leaving now will discard it.`}
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const resume = pending;
          setPending(null);
          setReleased(true);
          resume?.();
        }}
      />
    ),
  };
}
