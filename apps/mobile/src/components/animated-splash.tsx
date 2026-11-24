import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { color as palette } from '@/theme/tokens';
import { MAX_HOLD_MS, isHolding } from './splash-hold';
import splashLogo from '../../assets/splash-icon.png';

/** Must match `imageWidth` of the expo-splash-screen plugin in app.json. */
const LOGO = 128;
/** The native splash fades off over this copy of itself, so its fade is invisible. */
const NATIVE_FADE_MS = 200;
/** If the logo never reports loaded, take over anyway. */
const SAFETY_MS = 1500;
/** Reveal: accelerates away, like the bottom sheet's exit. */
const REVEAL = { duration: 380, easing: Easing.bezier(0.3, 0, 0.8, 0.15) };
const REVEAL_REDUCED = { duration: 200, easing: Easing.out(Easing.quad) };

// Keep the native splash up until the animated copy is on screen (Expo Router would otherwise
// hide it after the first render).
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: NATIVE_FADE_MS, fade: true });

/**
 * Opening animation. The native splash (pink canvas, centred logo; app.json) shows while the app
 * loads. This overlay draws exactly the same thing, takes over from it, gives the heart-paw a
 * quick "lub-dub" heartbeat, then zooms the logo towards the viewer as the canvas fades to reveal
 * the first screen. About one second in all.
 *
 * Reduced motion: no heartbeat or zoom, just a short fade. Native driver only (transform and
 * opacity). Touches are blocked until the reveal starts.
 * `hold`: keeps the takeover waiting (native splash stays up) until it turns false.
 */
export function AnimatedSplash({ hold = false }: { hold?: boolean }) {
  const [beat] = useState(() => new Animated.Value(1));
  const [reveal] = useState(() => new Animated.Value(0));
  const [zoom, setZoom] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const holdRef = useRef(hold);
  const [mountedAt] = useState(() => Date.now());
  const logoLoaded = useRef(false);

  // Takes over once the logo has been drawn (so the native splash never uncovers a blank
  // canvas), or after a safety timeout so the splash can never stay up. `force` skips the hold.
  const start = useCallback(
    async (force = false) => {
      if (started.current) return;
      if (!force && isHolding(holdRef.current, Date.now() - mountedAt)) return;
      started.current = true;
      // Read once before the first frame; the motion hook's first value is only a guess.
      const reduced = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      setZoom(!reduced);
      await SplashScreen.hideAsync().catch(() => undefined);

      const heartbeat = reduced
        ? Animated.delay(NATIVE_FADE_MS)
        : Animated.sequence([
            Animated.delay(NATIVE_FADE_MS),
            beatTo(beat, 1.1, 140, Easing.out(Easing.quad)),
            beatTo(beat, 0.97, 130, Easing.inOut(Easing.quad)),
            beatTo(beat, 1.06, 120, Easing.out(Easing.quad)),
            beatTo(beat, 1, 160, Easing.inOut(Easing.quad)),
          ]);
      heartbeat.start(() => {
        setRevealing(true);
        Animated.timing(reveal, {
          toValue: 1,
          ...(reduced ? REVEAL_REDUCED : REVEAL),
          useNativeDriver: true,
        }).start(() => setDone(true));
      });
    },
    [beat, reveal, mountedAt],
  );

  // While `hold` is set (the database is opening) the takeover waits; the safety timeout only
  // starts once the hold is released. Without a hold this is the original behaviour.
  useEffect(() => {
    holdRef.current = hold;
    if (hold) return;
    // The logo may have loaded while held; its one-shot load event won't repeat.
    if (logoLoaded.current) void start();
    const fallback = setTimeout(() => void start(), SAFETY_MS);
    return () => clearTimeout(fallback);
  }, [hold, start]);

  // A stuck open must not keep the splash up forever: take over after MAX_HOLD_MS regardless,
  // forced so a wall clock that moved can't make the hold look unfinished.
  useEffect(() => {
    const limit = setTimeout(() => void start(true), MAX_HOLD_MS);
    return () => clearTimeout(limit);
  }, [start]);

  if (done) return null;

  const canvasOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const logoOpacity = reveal.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const logoScale = Animated.multiply(
    beat,
    reveal.interpolate({ inputRange: [0, 1], outputRange: [1, zoom ? 1.6 : 1] }),
  );

  return (
    <Animated.View
      pointerEvents={revealing ? 'none' : 'auto'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.canvas, { opacity: canvasOpacity }]}
    >
      <Animated.Image
        source={splashLogo}
        onLoadEnd={() => {
          logoLoaded.current = true;
          void start();
        }}
        style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
      />
    </Animated.View>
  );
}

function beatTo(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing: (t: number) => number,
) {
  return Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg.canvas,
  },
  logo: { width: LOGO, height: LOGO },
});
