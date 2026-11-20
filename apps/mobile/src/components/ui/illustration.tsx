import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import { color as palette } from '@/theme/tokens';

// Flat object illustrations exported from Figma (Components → Illustrations), 48 px artboard.
import Bell from '../../../assets/illustrations/bell.svg';
import Bone from '../../../assets/illustrations/bone.svg';
import Box from '../../../assets/illustrations/box.svg';
import Calendar from '../../../assets/illustrations/calendar.svg';
import Comb from '../../../assets/illustrations/comb.svg';
import FirstAid from '../../../assets/illustrations/first-aid.svg';
import FoodBag from '../../../assets/illustrations/food-bag.svg';
import Paw from '../../../assets/illustrations/paw.svg';
import PillBottle from '../../../assets/illustrations/pill-bottle.svg';
import Report from '../../../assets/illustrations/report.svg';
import Shampoo from '../../../assets/illustrations/shampoo.svg';
import Syringe from '../../../assets/illustrations/syringe.svg';
import Toothbrush from '../../../assets/illustrations/toothbrush.svg';
import Vial from '../../../assets/illustrations/vial.svg';

const illustrations = {
  bell: Bell,
  bone: Bone,
  box: Box,
  calendar: Calendar,
  comb: Comb,
  'first-aid': FirstAid,
  'food-bag': FoodBag,
  paw: Paw,
  'pill-bottle': PillBottle,
  report: Report,
  shampoo: Shampoo,
  syringe: Syringe,
  toothbrush: Toothbrush,
  vial: Vial,
} satisfies Record<string, FC<SvgProps>>;

export type IllustrationName = keyof typeof illustrations;

/** Decorative illustration; outlines keep the design's text/primary ink. */
export function Illustration({ name, size = 48 }: { name: IllustrationName; size?: number }) {
  const Svg = illustrations[name];
  return (
    <Svg
      width={size}
      height={size}
      color={palette.text.primary}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
