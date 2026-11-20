import { useEffect, useState } from 'react';
import { AccessibilityInfo, Dimensions, Easing } from 'react-native';
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
 * The last pet switch, so pet-specific blocks that mount because of a switch (e.g. a Next visit
 * card that only the new pet has) can animate in from the same side as the rest of the content.
 */
export const lastPetSwitch = { at: 0, direction: 1 as 1 | -1 };

export function notePetSwitch(direction: 1 | -1) {
  lastPetSwitch.at = Date.now();
  lastPetSwitch.direction = direction;
}
