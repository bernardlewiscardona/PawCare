import { useEffect, useState } from 'react';
import { AccessibilityInfo, Dimensions, Easing } from 'react-native';
import type { NativeStackNavigationOptions } from 'expo-router';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';

/** True when the user asked the OS to reduce motion; animations then shorten to a fade. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** How far a tab screen travels while sliding in or out (about a quarter of the width). */
const SLIDE_DISTANCE = Math.round(Dimensions.get('window').width * 0.28);

/**
 * Tab scene transition: the new tab slides in from the side of the tab you tapped while the old
 * one slides away. `progress` is -1 (left of active), 0 (active) or 1 (right).
 *
 * Each screen is fully opaque within 60% of its travel, so the incoming screen (drawn on top)
 * covers the outgoing one early instead of the two cross-fading through each other.
 */
export const slideTabTransition: Pick<
  BottomTabNavigationOptions,
  'transitionSpec' | 'sceneStyleInterpolator'
> = {
  transitionSpec: {
    animation: 'timing',
    config: { duration: 300, easing: Easing.out(Easing.cubic) },
  },
  sceneStyleInterpolator: ({ current }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, -0.6, 0, 0.6, 1],
        outputRange: [0, 1, 1, 1, 0],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-SLIDE_DISTANCE, 0, SLIDE_DISTANCE],
          }),
        },
      ],
    },
  }),
};

/**
 * Native stack transitions. Every screen change runs natively (react-native-screens), so the
 * JS thread is free while it moves. Timing is fixed by the platform where it can't be set:
 * Android takes its durations from react-native-screens' animation resources, and
 * `animationDuration` only applies on iOS.
 *
 * - page: slides in from the right over the page below, which shifts left (Android 200 ms; iOS
 *   native push and edge swipe).
 * - task: slides up over the page below, which stays still, and back down (400 ms each way); on
 *   iOS it can also be swiped down from its header.
 * - fade: a 150 ms cross-fade.
 * - handoff: the fade, used when entering or leaving the app (into Home, back to Welcome).
 *
 * Reduced motion: every kind becomes the 150 ms fade.
 */
export type StackTransition = Pick<
  NativeStackNavigationOptions,
  | 'animation'
  | 'animationDuration'
  | 'animationTypeForReplace'
  | 'gestureEnabled'
  | 'gestureDirection'
  | 'gestureResponseDistance'
>;

export type ScreenTransitionKind = 'page' | 'authStep' | 'task' | 'fade' | 'handoff' | 'platform';

/** Matches Android's fixed fade (react-native-screens `rns_fade_in`/`rns_fade_out`). */
const FADE_MS = 150;
/** Matches Android's `slide_from_bottom` (`config_mediumAnimTime`), so tasks feel the same on both. */
const TASK_MS = 400;
/** Height of the Figma "Header" (56) plus a little slack: where a task can be swiped down on iOS. */
const TASK_GESTURE_ZONE = 64;

/**
 * Pushed page (`DetailHeader`, lists). Back reverses it; iOS keeps its native edge swipe and
 * Android its system back.
 *
 * A create form replaces itself with the record it saved. A `pop` replace plays the outgoing
 * screen's exit, so the form slides down onto the record. React Navigation defaults replaces to
 * `push` (the record would slide in over the form), so pages set `pop` explicitly.
 */
export const pageTransition: StackTransition = {
  animation: 'ios_from_right',
  animationTypeForReplace: 'pop',
};

/**
 * An auth or onboarding step. Steps move forward with `router.replace` (so Back doesn't return to
 * a finished step); a `push` replace slides the next step in like a push.
 */
export const authStepTransition: StackTransition = {
  ...pageTransition,
  animationTypeForReplace: 'push',
};

/**
 * Modal task (`ModalHeader`: create and edit forms, Settings, Manage files). It rises from the
 * bottom and slides back down when closed or saved, including onto the record a create form
 * saved (see `pageTransition`).
 *
 * On iOS it can be swiped down from its header. The swipe starts only in the header so it never
 * competes with scrolling the form. Android has no swipe-down for full-screen stack screens.
 */
export function taskTransition(topInset: number): StackTransition {
  return {
    animation: 'slide_from_bottom',
    animationDuration: TASK_MS,
    gestureDirection: 'vertical',
    gestureResponseDistance: { bottom: topInset + TASK_GESTURE_ZONE },
  };
}

/** Viewer that shouldn't feel like a new place (an attachment preview). No gesture. */
export const fadeTransition: StackTransition = {
  animation: 'fade',
  animationDuration: FADE_MS,
  gestureEnabled: false,
};

/**
 * Entering or leaving the signed-in app: Home after sign-in or onboarding, Welcome after sign-out
 * or account deletion. These arrive by replacing the whole stack, so they fade in over it
 * instead of the stack unwinding screen by screen.
 */
export const handoffTransition: StackTransition = {
  animation: 'fade',
  animationDuration: FADE_MS,
  animationTypeForReplace: 'push',
};

/**
 * Each stack route (Expo Router name) and how it moves, decided by the header it renders.
 * Tabs switch inside `(tabs)` with `slideTabTransition`. Unknown routes move as pages.
 */
export const SCREEN_TRANSITIONS: Record<string, ScreenTransitionKind> = {
  // Auth and onboarding.
  index: 'handoff',
  register: 'authStep',
  'sign-in': 'authStep',
  'profile-setup': 'authStep',
  'first-pet': 'authStep',
  // Reached only by the onboarding pet form replacing itself, which slides down onto it.
  'turn-on-reminders': 'page',
  '(tabs)': 'handoff',
  dev: 'platform',

  'pets/index': 'page',
  'pets/new': 'task',
  'pets/[id]/index': 'page',
  'pets/[id]/edit': 'task',
  'visits/new': 'task',
  'visits/[id]/index': 'page',
  'visits/[id]/edit': 'task',
  'vaccines/new': 'task',
  'vaccines/[id]/index': 'page',
  'vaccines/[id]/edit': 'task',
  'prescriptions/new': 'task',
  'prescriptions/[id]/index': 'page',
  'prescriptions/[id]/edit': 'task',
  'records/new': 'task',
  'records/[id]/index': 'page',
  'records/[id]/edit': 'task',
  'records/[id]/files': 'task',
  'records/[id]/file/[fileId]': 'fade',
  'reminders/index': 'page',
  'reminders/new': 'task',
  'reminders/[id]': 'task',
  'supplies/new': 'task',
  'supplies/[id]': 'page',
  'settings/index': 'task',
  'settings/notifications': 'page',
  'settings/delete-account': 'page',
};

/** Stack options for a route. `topInset` is the safe-area top, used for the task swipe zone. */
export function screenTransition(
  routeName: string,
  { reduceMotion, topInset }: { reduceMotion: boolean; topInset: number },
): StackTransition {
  const kind = SCREEN_TRANSITIONS[routeName] ?? 'page';
  if (kind === 'platform') return {};
  const preset = {
    page: pageTransition,
    authStep: authStepTransition,
    task: taskTransition(topInset),
    fade: fadeTransition,
    handoff: handoffTransition,
  }[kind];
  if (!reduceMotion) return preset;
  // Same stack behaviour (replace direction, gestures), but a short fade instead of movement.
  return {
    animation: 'fade',
    animationDuration: FADE_MS,
    ...(preset.animationTypeForReplace && {
      animationTypeForReplace: preset.animationTypeForReplace,
    }),
    ...(preset.gestureEnabled === false && { gestureEnabled: false }),
  };
}

/**
 * The last pet switch, so pet-specific blocks that mount because of a switch (e.g. a Next visit
 * card that only the new pet has) can animate in from the same side as the rest of the content.
 */
export const lastPetSwitch = { at: 0, direction: 1 as 1 | -1 };

export function notePetSwitch(direction: 1 | -1) {
  lastPetSwitch.at = Date.now();
  lastPetSwitch.direction = direction;
}
