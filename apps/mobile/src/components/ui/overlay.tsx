import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/lib/motion';
import { color as palette, radius, shadow, space } from '@/theme/tokens';
import { AppText } from './app-text';
import { IconTile } from './badges';
import { Button } from './button';
import { IconButton } from './icon-button';
import type { IllustrationName } from './illustration';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** iOS-style sheet curve: a quick lift that settles gently, with no bounce at the bottom edge. */
const SHEET_IN = { duration: 420, easing: Easing.bezier(0.32, 0.72, 0, 1) };
/** Leaving accelerates away and is quicker than arriving, so closing never feels sluggish. */
const SHEET_OUT = { duration: 240, easing: Easing.bezier(0.3, 0, 0.8, 0.15) };
/** After a swipe down the sheet keeps the finger's momentum instead of restarting from rest. */
const SHEET_FLING = { duration: 200, easing: Easing.out(Easing.quad) };
/** Reduce motion: no sliding, just a short fade. */
const SHEET_FADE = { duration: 180, easing: Easing.out(Easing.quad) };
/** Extra travel so the sheet's upward shadow is off screen too when closed. */
const SHADOW_CLEARANCE = 24;

/**
 * Bottom sheet: white panel (radius 2xl top corners, Sheet shadow) over the scrim, topped by the
 * Figma "Sheet Header" (grabber, title, close).
 *
 * It slides up from the bottom edge as the scrim fades in, and slides back down to close: from
 * the close button, the scrim, Back, or by dragging the header down. One native-driven value
 * moves the sheet and the scrim together. While closing it keeps showing the content it had, so
 * callers can clear their state straight away. Honours the system "reduce motion" setting.
 */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  // Stay mounted through the exit animation. The sheet keeps rendering live content while it
  // slides away (so a choice made in it shows as it leaves); only when the caller clears the
  // content on close does it fall back to the last content it had, instead of collapsing.
  const [mounted, setMounted] = useState(visible);
  const [shown, setShown] = useState({ title, children });
  if (visible && !mounted) setMounted(true);
  const cleared = children == null || children === false;
  if (!cleared && (shown.title !== title || shown.children !== children)) {
    setShown({ title, children });
  }
  const content = cleared ? shown : { title, children };

  // 0 = off screen, 1 = fully open.
  const [progress] = useState(() => new Animated.Value(0));
  const [sheetHeight, setSheetHeight] = useState(0);
  const measured = sheetHeight > 0;
  const travel = (sheetHeight || windowHeight) + SHADOW_CLEARANCE;
  const flung = useRef(false);

  useEffect(() => {
    if (visible) {
      // The first open waits for layout, so the slide covers exactly the sheet's height.
      if (!measured) return;
      flung.current = false;
      Animated.timing(progress, {
        toValue: 1,
        ...(reduceMotion ? SHEET_FADE : SHEET_IN),
        useNativeDriver: true,
      }).start();
      return;
    }
    const exit = reduceMotion ? SHEET_FADE : flung.current ? SHEET_FLING : SHEET_OUT;
    Animated.timing(progress, { toValue: 0, ...exit, useNativeDriver: true }).start(
      ({ finished }) => {
        // Reopening mid-exit interrupts this animation, so the sheet stays.
        if (finished) setMounted(false);
      },
    );
  }, [visible, measured, progress, reduceMotion]);

  // Drag the header down to dismiss; a short or slow drag springs back open.
  //
  // The header claims the touch as soon as it starts. The responder system follows the React
  // tree, not the Modal's window, so the screen's ScrollView behind the sheet is an ancestor
  // here; once it holds the touch, a child could never take it over by moving. Taps on the
  // close button still work: the deepest component is asked first.
  const gesture = useRef({ y: 0, from: 1, lastY: 0, lastAt: 0, velocity: 0 });
  const settle = () =>
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 26,
      stiffness: 300,
      overshootClamping: true,
    }).start();
  const dragHandlers = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      const g = gesture.current;
      g.y = g.lastY = e.nativeEvent.pageY;
      g.lastAt = e.nativeEvent.timestamp;
      g.velocity = 0;
      progress.stopAnimation((value) => (g.from = value));
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      const { pageY, timestamp } = e.nativeEvent;
      if (timestamp > g.lastAt) g.velocity = (pageY - g.lastY) / (timestamp - g.lastAt);
      g.lastY = pageY;
      g.lastAt = timestamp;
      progress.setValue(Math.min(1, Math.max(0, g.from - (pageY - g.y) / travel)));
    },
    onResponderRelease: () => {
      const g = gesture.current;
      if (g.lastY - g.y > travel * 0.3 || g.velocity > 0.9) {
        flung.current = true;
        onClose();
      } else {
        settle();
      }
    },
    onResponderTerminate: settle,
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.fill}
      >
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable
            style={styles.grow}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setSheetHeight(Math.round(e.nativeEvent.layout.height))}
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, space[4]),
              opacity: reduceMotion ? progress : 1,
              transform: [
                {
                  translateY: reduceMotion
                    ? 0
                    : progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [travel, 0],
                        extrapolate: 'clamp',
                      }),
                },
              ],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header} {...dragHandlers}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <AppText variant="titleM" accessibilityRole="header" style={styles.grow}>
                {content.title}
              </AppText>
              <IconButton
                icon="x"
                variant="surface"
                size={32}
                accessibilityLabel="Close"
                onPress={onClose}
              />
            </View>
          </View>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            {content.children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type DialogProps = {
  visible: boolean;
  title: string;
  body: string;
  illustration?: IllustrationName;
  tone?: 'default' | 'destructive';
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Figma "Dialog": confirmation over the scrim (overlap warning, time zone change, discard). */
export function Dialog({
  visible,
  title,
  body,
  illustration = 'bell',
  tone = 'default',
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: DialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.scrim, styles.center]}>
        <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
          <IconTile
            illustration={illustration}
            size="medium"
            tone={tone === 'destructive' ? 'red' : 'yellow'}
          />
          <AppText variant="titleM" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="bodyM" color={palette.text.secondary}>
            {body}
          </AppText>
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              size="small"
              variant="secondary"
              style={styles.grow}
              onPress={onCancel}
            />
            <Button
              label={confirmLabel}
              size="small"
              variant={tone === 'destructive' ? 'destructive' : 'primary'}
              style={styles.grow}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  grow: { flex: 1 },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: palette.bg.scrim,
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: space[6] },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    backgroundColor: palette.bg.screen,
    ...shadow.sheet,
  },
  header: {
    alignItems: 'center',
    gap: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    paddingHorizontal: space[5],
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: palette.bg.surfaceStrong,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], alignSelf: 'stretch' },
  body: {
    gap: space[3],
    paddingTop: space[1],
    paddingHorizontal: space[5],
    paddingBottom: space[4],
  },
  dialog: {
    width: '100%',
    maxWidth: 329,
    gap: space[3],
    paddingTop: space[6],
    paddingHorizontal: space[6],
    paddingBottom: space[5],
    borderRadius: radius['2xl'],
    backgroundColor: palette.bg.screen,
    ...shadow.float,
  },
  actions: { flexDirection: 'row', gap: space[2], paddingTop: space[2] },
});
