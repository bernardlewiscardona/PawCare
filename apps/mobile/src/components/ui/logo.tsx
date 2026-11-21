import { Image, View } from 'react-native';
import { shadow } from '@/theme/tokens';
import logo from '../../../assets/logo.png';

/** Corner radius as a share of the mark's size, as on the Figma "Logo/Mark" (18 of 64). */
const CORNER = 18 / 64;

/** Brand mark: the PawCare app icon (Glossy Heart Paw), announced as "PawCare". */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="PawCare"
      style={[shadow.soft, { width: size, height: size, borderRadius: size * CORNER }]}
    >
      <Image source={logo} style={{ width: size, height: size }} />
    </View>
  );
}
