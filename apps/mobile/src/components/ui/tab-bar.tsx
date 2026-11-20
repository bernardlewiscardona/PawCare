import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/lib/motion';
import { color as palette, radius, shadow, space } from '@/theme/tokens';
import { Icon, type IconName } from './icon';

export const TAB_BAR_HEIGHT = 64;
const MIN_BOTTOM_OFFSET = 16;
const ITEM = 48;
const BAR_PADDING = space[2] + 2;

/** Space a scrolling tab screen must leave at the bottom so content clears the floating bar. */
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, MIN_BOTTOM_OFFSET) + space[6];
}

export type TabMeta = { icon: IconName; label: string; showDot?: boolean };

/**
 * Figma "Tab Bar": floating black pill (Float shadow); the active tab is a white disc. Switching
 * tabs springs the disc to its new place with a short liquid stretch, and each icon cross-fades
 * from white to black as the disc passes under it. Icons only, so every tab carries an
 * accessibility label and its selected state. Honours the system "reduce motion" setting.
 */
export function FloatingTabBar({
  state,
  emitter,
  navigateToTab,
  tabs,
}: BottomTabBarProps & { tabs: Record<string, TabMeta> }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const routes = state.routes.filter((r) => tabs[r.name]);
  const active = Math.max(
    0,
    routes.findIndex((r) => r.key === state.routes[state.index]?.key),
  );

  const [position] = useState(() => new Animated.Value(active));
  const [stretch] = useState(() => new Animated.Value(0));
  const [press] = useState(() => routes.map(() => new Animated.Value(1)));

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(active);
      return;
    }
    Animated.parallel([
      Animated.spring(position, {
        toValue: active,
        useNativeDriver: true,
        damping: 18,
        stiffness: 190,
        mass: 0.9,
      }),
      Animated.sequence([
        Animated.timing(stretch, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(stretch, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [active, position, stretch, reduceMotion]);

  // The bar spans the window minus its 20 px gutters; items are spread evenly inside it.
  const barWidth = windowWidth - space[5] * 2;
  const first = BAR_PADDING;
  const last = barWidth - BAR_PADDING - ITEM;
  const translateX =
    routes.length > 1
      ? position.interpolate({
          inputRange: [0, routes.length - 1],
          outputRange: [first, last],
          // Let the spring overshoot between tabs, but never past the ends of the bar.
          extrapolate: 'clamp',
        })
      : first;

  const bounce = (i: number) => {
    if (reduceMotion) return;
    const v = press[i];
    if (!v) return;
    v.setValue(0.82);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 260 }).start();
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { bottom: Math.max(insets.bottom, MIN_BOTTOM_OFFSET) }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.disc,
          {
            transform: [
              { translateX },
              { scaleX: stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) },
              { scaleY: stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) },
            ],
          },
        ]}
      />
      {routes.map((route, i) => {
        const meta = tabs[route.name];
        const focused = i === active;
        const near = { inputRange: [i - 1, i, i + 1], extrapolate: 'clamp' as const };

        const onPress = () => {
          bounce(i);
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={meta.showDot ? `${meta.label}, unread reminders` : meta.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            <Animated.View style={[styles.iconStack, { transform: [{ scale: press[i] ?? 1 }] }]}>
              <Animated.View
                style={[
                  styles.layer,
                  { opacity: position.interpolate({ ...near, outputRange: [1, 0, 1] }) },
                ]}
              >
                <Icon name={meta.icon} size={22} color={palette.text.inverse} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.layer,
                  { opacity: position.interpolate({ ...near, outputRange: [0, 1, 0] }) },
                ]}
              >
                <Icon name={meta.icon} size={22} color={palette.text.primary} />
              </Animated.View>
            </Animated.View>
            {meta.showDot ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space[5],
    right: space[5],
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BAR_PADDING,
    paddingVertical: space[2],
    borderRadius: radius.full,
    backgroundColor: palette.bg.inverse,
    ...shadow.float,
  },
  disc: {
    position: 'absolute',
    left: 0,
    top: (TAB_BAR_HEIGHT - ITEM) / 2,
    width: ITEM,
    height: ITEM,
    borderRadius: radius.full,
    backgroundColor: palette.bg.screen,
  },
  item: {
    width: ITEM,
    height: ITEM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  iconStack: { width: 22, height: 22 },
  layer: { position: 'absolute', top: 0, left: 0 },
  dot: {
    position: 'absolute',
    top: 10,
    left: 30,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent.pink,
  },
});
