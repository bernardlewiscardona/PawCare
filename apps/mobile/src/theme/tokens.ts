/**
 * PawCare design tokens, mirrored from the Figma file "00 Design System":
 * variable collections PawCare / Primitives, Color, Spacing, Radius; the PawCare/* text
 * styles; and the PawCare/* effect styles. Keep names aligned with Figma so a token can
 * be traced back to its variable.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const primitives = {
  neutral0: '#ffffff',
  neutral50: '#f4f1ed',
  neutral100: '#ebe7e2',
  neutral150: '#e6e2dd',
  neutral500: '#8b8782',
  neutral900: '#111111',
  pink50: '#f9dce8',
  pink200: '#ffc6ea',
  pink400: '#ff88d3',
  blue200: '#c6f1fd',
  blue400: '#84e2fa',
  green200: '#d2fac0',
  green400: '#a6f686',
  yellow200: '#ffe68f',
  yellow400: '#ffcd20',
  red100: '#fde2e3',
  red500: '#e5484d',
  red700: '#b42318',
  scrim: 'rgba(17, 17, 17, 0.4)',
} as const;

const p = primitives;

/** PawCare / Color (Light mode). */
export const color = {
  bg: {
    screen: p.neutral0,
    canvas: p.pink50,
    surface: p.neutral50,
    surfaceStrong: p.neutral100,
    inverse: p.neutral900,
    scrim: p.scrim,
  },
  text: {
    primary: p.neutral900,
    secondary: p.neutral500,
    inverse: p.neutral0,
    danger: p.red700,
  },
  border: {
    default: p.neutral150,
    focus: p.neutral900,
    danger: p.red500,
  },
  primary: { default: p.neutral900, on: p.neutral0 },
  success: { default: p.green400, subtle: p.green200 },
  warning: { default: p.yellow400, subtle: p.yellow200 },
  danger: { default: p.red500, subtle: p.red100, strong: p.red700 },
  info: { default: p.blue400, subtle: p.blue200 },
  accent: { blue: p.blue400, pink: p.pink400, green: p.green400, yellow: p.yellow400 },
  tint: { blue: p.blue200, pink: p.pink200, green: p.green200, yellow: p.yellow200 },
  kind: {
    medical: p.pink200,
    vaccine: p.blue200,
    prescription: p.green200,
    visit: p.yellow200,
  },
} as const;

/** Background for every status chip, keyed by the Figma `status/*` variable name. */
export const statusColor = {
  planned: p.blue200,
  'needs-update': p.yellow200,
  completed: p.green200,
  missed: p.red100,
  canceled: p.neutral100,
  active: p.green200,
  voided: p.neutral100,
  'due-soon': p.blue200,
  due: p.yellow200,
  overdue: p.red100,
  fulfilled: p.green200,
  ended: p.neutral100,
  stopped: p.neutral100,
  taken: p.green200,
  skipped: p.neutral100,
  upcoming: p.neutral100,
  'due-now': p.yellow200,
  'low-stock': p.yellow200,
  expiring: p.yellow200,
  expired: p.red100,
  usable: p.green200,
  'unknown-expiry': p.neutral100,
  scanning: p.blue200,
  rejected: p.red100,
  failed: p.red100,
  archived: p.neutral100,
  delayed: p.yellow200,
  'no-longer-needed': p.neutral100,
} as const;

export type StatusKey = keyof typeof statusColor;
export type RecordKind = keyof typeof color.kind;

/** PawCare / Spacing — `space/N`. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** PawCare / Radius. */
export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  '2xl': 28,
  full: 999,
} as const;

/** Lexend weights loaded in the root layout (see `fontAssets`). */
export const fontFamily = {
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
} as const;

const textStyle = (
  family: string,
  fontSize: number,
  lineHeightRatio: number,
  letterSpacingPercent = 0,
): TextStyle => ({
  fontFamily: family,
  fontSize,
  lineHeight: Math.round(fontSize * lineHeightRatio * 10) / 10,
  letterSpacing: (fontSize * letterSpacingPercent) / 100,
});

/** PawCare/* text styles. */
export const type = {
  display: textStyle(fontFamily.semibold, 30, 1.2, -1),
  titleL: textStyle(fontFamily.semibold, 22, 1.25, -0.5),
  titleM: textStyle(fontFamily.medium, 18, 1.25),
  titleS: textStyle(fontFamily.medium, 15, 1.3),
  bodyL: textStyle(fontFamily.regular, 16, 1.45),
  bodyM: textStyle(fontFamily.regular, 14, 1.4),
  label: textStyle(fontFamily.medium, 13, 1.3),
  caption: textStyle(fontFamily.regular, 12, 1.3),
  button: textStyle(fontFamily.medium, 15, 1.2),
  buttonS: textStyle(fontFamily.medium, 13, 1.2),
  overline: { ...textStyle(fontFamily.medium, 11, 1.2, 6), textTransform: 'uppercase' },
  numeric: textStyle(fontFamily.semibold, 20, 1.1, -0.5),
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** PawCare/* effect styles. */
export const shadow = {
  float: { boxShadow: '0px 10px 30px -6px rgba(17, 17, 17, 0.18)' },
  soft: { boxShadow: '0px 2px 8px 0px rgba(17, 17, 17, 0.08)' },
  sheet: { boxShadow: '0px -6px 28px 0px rgba(17, 17, 17, 0.14)' },
} satisfies Record<string, ViewStyle>;

/** Minimum touch target (Android 48dp / iOS 44pt); the design's 44 px controls meet iOS. */
export const hitSlop = { top: 4, bottom: 4, left: 4, right: 4 } as const;
