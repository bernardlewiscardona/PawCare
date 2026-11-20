import { Pressable, StyleSheet, View } from 'react-native';
import { color as palette, radius, shadow, space } from '@/theme/tokens';
import { AppText } from './app-text';

type Segment<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** Figma "Segmented Control": 2–3 options on a surface track with a white, softly shadowed thumb. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="radio"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, selected && styles.thumb]}
          >
            <AppText
              variant="buttonS"
              color={selected ? palette.text.primary : palette.text.secondary}
              numberOfLines={1}
            >
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 44,
    flexDirection: 'row',
    gap: space[1],
    padding: space[1],
    borderRadius: radius.full,
    backgroundColor: palette.bg.surface,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  thumb: { backgroundColor: palette.bg.screen, ...shadow.soft },
});
