import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Avatar, type AvatarKey } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/pill';
import { lastPetSwitch, notePetSwitch, useReducedMotion } from '@/lib/motion';
import { useActivePets, useSelectedPet } from '@/lib/store';
import { color as palette, radius, space } from '@/theme/tokens';

type Box = { x: number; width: number };

const PILL_HEIGHT = 40;
const CAP = PILL_HEIGHT; // the round ends are 40 × 40 circles
const BAR = 100; // reference width of the middle bar before scaling
const SPRING = { damping: 20, stiffness: 230, mass: 0.9 } as const;

/**
 * Active pets as Figma "Pet Pill"s (PF-03) with one shared selection highlight.
 *
 * Choosing a pet springs the black highlight to it while it morphs to the new pill's width;
 * names cross-fade, borders dissolve and the new pet's avatar pops. The highlight is built from
 * two round caps and a middle bar that only move/scale, so every frame runs on the native UI
 * thread with no layout work — smooth even while the row scrolls the pill into view.
 *
 * Tapping the already-active pill opens the switcher when `onActivePress` is given. Archived pets
 * never appear. Honours the system "reduce motion" setting.
 */
export function PetRow({
  showAdd = false,
  onActivePress,
}: {
  showAdd?: boolean;
  onActivePress?: () => void;
}) {
  const pets = useActivePets();
  const { pet: selected, selectPet } = useSelectedPet();
  const reduceMotion = useReducedMotion();
  const { width: viewport } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const active = Math.max(
    0,
    pets.findIndex((p) => p.id === selected?.id),
  );
  // One value drives the highlight, labels and borders, so they always move together.
  const [position] = useState(() => new Animated.Value(active));

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(active);
      return;
    }
    Animated.spring(position, { toValue: active, useNativeDriver: true, ...SPRING }).start();
  }, [active, position, reduceMotion]);

  // Keep the chosen pill in view, centred when the row can scroll.
  const activeBox = selected ? boxes[selected.id] : undefined;
  useEffect(() => {
    if (!activeBox) return;
    scroll.current?.scrollTo({
      x: Math.max(0, activeBox.x + activeBox.width / 2 - viewport / 2),
      animated: !reduceMotion,
    });
  }, [activeBox, viewport, reduceMotion]);

  const measured = pets.length > 0 && pets.every((p) => boxes[p.id]);
  const geometry = pets.map((p) => boxes[p.id] ?? { x: 0, width: CAP });
  const track = (values: number[]) =>
    pets.length > 1
      ? position.interpolate({
          inputRange: pets.map((_, i) => i),
          outputRange: values,
          extrapolate: 'clamp',
        })
      : (values[0] ?? 0);

  // Caps sit at each pill's ends; the bar is centred between them and scaled to fill the gap.
  const leftCap = track(geometry.map((b) => b.x));
  const rightCap = track(geometry.map((b) => b.x + b.width - CAP));
  const barCentre = track(geometry.map((b) => b.x + b.width / 2 - BAR / 2));
  const barScale = track(geometry.map((b) => Math.max(0.01, (b.width - CAP) / BAR)));

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Pets"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {measured ? (
        <View pointerEvents="none" style={styles.highlightLayer}>
          <Animated.View style={[styles.cap, { transform: [{ translateX: leftCap }] }]} />
          <Animated.View
            style={[styles.bar, { transform: [{ translateX: barCentre }, { scaleX: barScale }] }]}
          />
          <Animated.View style={[styles.cap, { transform: [{ translateX: rightCap }] }]} />
        </View>
      ) : null}
      {pets.map((p, i) => (
        <PetPillItem
          key={p.id}
          name={p.name}
          avatar={p.avatar}
          selected={i === active}
          index={i}
          position={position}
          animated={measured}
          reduceMotion={reduceMotion}
          onLayout={(box) =>
            setBoxes((b) =>
              b[p.id]?.x === box.x && b[p.id]?.width === box.width ? b : { ...b, [p.id]: box },
            )
          }
          onPress={() => {
            if (i === active) {
              onActivePress?.();
              return;
            }
            notePetSwitch(i > active ? 1 : -1);
            selectPet(p.id);
          }}
        />
      ))}
      {showAdd ? (
        <Chip label="Add pet" icon="plus" onPress={() => router.push('/pets/new')} />
      ) : null}
    </ScrollView>
  );
}

function PetPillItem({
  name,
  avatar,
  selected,
  index,
  position,
  animated,
  reduceMotion,
  onLayout,
  onPress,
}: {
  name: string;
  avatar?: AvatarKey;
  selected: boolean;
  index: number;
  position: Animated.Value;
  /** False until every pill is measured; then the shared highlight takes over. */
  animated: boolean;
  reduceMotion: boolean;
  onLayout: (box: Box) => void;
  onPress: () => void;
}) {
  const [press] = useState(() => new Animated.Value(1));
  const [pop] = useState(() => new Animated.Value(1));
  const wasSelected = useRef(selected);

  // Pop the avatar when this pet becomes the active one (not on first render).
  useEffect(() => {
    const became = selected && !wasSelected.current;
    wasSelected.current = selected;
    if (!became || reduceMotion) return;
    pop.setValue(0.78);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 240 }).start();
  }, [selected, pop, reduceMotion]);

  const pressTo = (toValue: number) => {
    if (reduceMotion) return;
    Animated.timing(press, {
      toValue,
      duration: toValue < 1 ? 90 : 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const near = { inputRange: [index - 1, index, index + 1], extrapolate: 'clamp' as const };
  const onInk = animated
    ? position.interpolate({ ...near, outputRange: [0, 1, 0] })
    : selected
      ? 1
      : 0;
  const offInk = animated
    ? position.interpolate({ ...near, outputRange: [1, 0, 1] })
    : selected
      ? 0
      : 1;
  // The outline clears in the first half of the trip, so it never shows through the arriving
  // highlight's edge, and returns only once the highlight has mostly left.
  const outline = animated
    ? position.interpolate({
        inputRange: [index - 1, index - 0.5, index, index + 0.5, index + 1],
        outputRange: [1, 0, 0, 0, 1],
        extrapolate: 'clamp',
      })
    : selected
      ? 0
      : 1;

  return (
    <Animated.View
      onLayout={(e) => onLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
      style={{ transform: [{ scale: press }] }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={name}
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={() => pressTo(0.95)}
        onPressOut={() => pressTo(1)}
        style={[styles.pill, !animated && selected ? styles.pillSelected : null]}
      >
        <Animated.View pointerEvents="none" style={[styles.outline, { opacity: outline }]} />
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Avatar avatar={avatar} size={32} />
        </Animated.View>
        <View>
          <Animated.View style={{ opacity: offInk }}>
            <AppText variant="label">{name}</AppText>
          </Animated.View>
          <Animated.View style={[styles.overlay, { opacity: onInk }]}>
            <AppText variant="label" color={palette.text.inverse}>
              {name}
            </AppText>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Wraps pet-specific content. When the selected pet changes, the new content fades in with a
 * short slide from the side of the pet that was picked, so it visibly follows the pill.
 */
export function PetTransition({
  petId,
  order,
  gap = 0,
  animateOnMount = false,
  children,
}: {
  petId: string | undefined;
  /** Position of the pet in the row; decides the slide direction. */
  order: number;
  gap?: number;
  /** Animate in when mounted by a pet switch (content only the new pet has). */
  animateOnMount?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const [shift] = useState(() => new Animated.Value(0));
  const previous = useRef({ petId, order });

  const run = (direction: number) => {
    opacity.setValue(0);
    shift.setValue(20 * direction);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(shift, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 210 }),
    ]).start();
  };

  useEffect(() => {
    if (animateOnMount && !reduceMotion && Date.now() - lastPetSwitch.at < 600) {
      run(lastPetSwitch.direction);
    }
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const before = previous.current;
    previous.current = { petId, order };
    if (before.petId === petId || reduceMotion) return;
    run(order >= before.order ? 1 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, order, reduceMotion]);

  return (
    <Animated.View style={{ gap, opacity, transform: [{ translateX: shift }] }}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Bleed to the screen edges so pills scroll under the gutter.
  scroll: { marginHorizontal: -space[5], flexGrow: 0 },
  row: { gap: space[2], paddingHorizontal: space[5], alignItems: 'center' },
  highlightLayer: { position: 'absolute', top: 0, left: 0, height: PILL_HEIGHT },
  cap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CAP,
    height: PILL_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: palette.bg.inverse,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BAR,
    height: PILL_HEIGHT,
    backgroundColor: palette.bg.inverse,
  },
  pill: {
    height: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[1],
    paddingRight: space[4],
    borderRadius: radius.full,
  },
  pillSelected: { backgroundColor: palette.bg.inverse },
  outline: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});
