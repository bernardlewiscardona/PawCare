import type { FC } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { color as palette } from '@/theme/tokens';
import { Icon } from './icon';

// Illustrated sample avatars from Figma (Components → Avatars & logo). Real photos replace these
// once pet photo upload (PF-02 / MR-02) exists.
import Bantay from '../../../assets/avatars/bantay.svg';
import Bea from '../../../assets/avatars/bea.svg';
import Kape from '../../../assets/avatars/kape.svg';
import Mochi from '../../../assets/avatars/mochi.svg';

const avatars = { bantay: Bantay, bea: Bea, kape: Kape, mochi: Mochi } satisfies Record<
  string,
  FC<SvgProps>
>;

export type AvatarKey = keyof typeof avatars;

type AvatarProps = {
  avatar?: AvatarKey;
  size?: number;
  /** Name to announce, e.g. the pet name. Omit when the name is already shown next to it. */
  accessibilityLabel?: string;
};

/** Round avatar, or a paw placeholder when there is no photo. */
export function Avatar({ avatar, size = 40, accessibilityLabel }: AvatarProps) {
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

  if (!avatar) {
    return (
      <View
        {...a11y}
        style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Icon name="paw-print" size={Math.round(size * 0.5)} color={palette.text.secondary} />
      </View>
    );
  }

  const Svg = avatars[avatar];
  return (
    <View {...a11y} style={{ width: size, height: size }}>
      <Svg width={size} height={size} color={palette.text.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg.surfaceStrong,
  },
});
