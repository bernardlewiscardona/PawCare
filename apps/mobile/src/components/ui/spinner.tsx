import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { color as palette } from '@/theme/tokens';
import SpinnerDark from '../../../assets/icons/spinner-dark.svg';
import SpinnerLight from '../../../assets/icons/spinner-light.svg';

type SpinnerProps = {
  /** Dark on light surfaces, Light on dark buttons (Figma: Spinner / Tone). */
  tone?: 'dark' | 'light';
  size?: number;
};

/** Decorative spinner; announce the busy state on the owning control instead. */
export function Spinner({ tone = 'dark', size = 20 }: SpinnerProps) {
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const Svg = tone === 'light' ? SpinnerLight : SpinnerDark;

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, transform: [{ rotate }] }}
    >
      <Svg width={size} height={size} color={palette.text.primary} />
    </Animated.View>
  );
}
