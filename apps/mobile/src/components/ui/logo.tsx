import { View } from 'react-native';
import { color as palette } from '@/theme/tokens';
import LogoMark from '../../../assets/avatars/logo-mark.svg';

/** Figma "Logo/Mark" (64 px artboard), announced as "PawCare". */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="PawCare"
      style={{ width: size, height: size }}
    >
      <LogoMark width={size} height={size} color={palette.text.primary} />
    </View>
  );
}
