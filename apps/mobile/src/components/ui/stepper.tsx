import { StyleSheet, View } from 'react-native';
import { color as palette, radius, space } from '@/theme/tokens';
import { AppText } from './app-text';
import { IconButton } from './icon-button';

type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  /** Unit shown after the value, already pluralised by the caller. */
  unit: string;
  min?: number;
  max?: number;
  /** Show a leading "+" for positive values (adjustments). */
  signed?: boolean;
  label: string;
};

/** Figma "Stepper": whole-unit quantity entry for pieces, tablets, capsules and sachets. */
export function Stepper({
  value,
  onChange,
  unit,
  min = 0,
  max = 9999,
  signed = false,
  label,
}: StepperProps) {
  const shown = signed && value > 0 ? `+${value}` : String(value);
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${shown} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - 1));
      }}
    >
      <IconButton
        icon="minus"
        size={32}
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      />
      <View style={styles.value}>
        <AppText variant="titleM">{shown}</AppText>
        <AppText variant="bodyM" color={palette.text.secondary}>
          {unit}
        </AppText>
      </View>
      <IconButton
        icon="plus"
        size={32}
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[1],
    borderRadius: radius.full,
    backgroundColor: palette.bg.surface,
    alignSelf: 'flex-start',
  },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
});
