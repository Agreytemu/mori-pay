import '@/global.css';

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * 4pt layout scale (with 2pt half steps). `base` is the default horizontal
 * screen gutter and the vertical rhythm unit between stacked elements.
 */
export const spacing = {
  none: 0,
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export type Spacing = typeof spacing;

/** Default horizontal padding for screen content. */
export const gutter = spacing.xl;

export const radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export type Radius = typeof radius;

/** Minimum comfortable touch target (Android/iOS accessibility guidance). */
export const hitTarget = {
  min: 44,
  /** Adds to a control's box to reach a comfortable touch target. */
  padding: spacing.md,
} as const;

export const borderWidth = {
  hair: 1,
  thick: 2,
} as const;

/** Money figures use tabular digits so columns of amounts stay aligned. */
export const numericText = {
  fontVariant: ['tabular-nums'],
} as const satisfies TextStyle;

/**
 * Elevation is intentionally subtle — depth should come from borders and
 * surface contrast rather than heavy shadows.
 */
export const shadows = {
  none: Platform.select({ web: { boxShadow: 'none' }, default: {} }) as ViewStyle,
  card: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(16, 24, 22, 0.06)' },
    ios: {
      shadowColor: '#0F1715',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 1 },
    default: {},
  }) as ViewStyle,
  raised: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(16, 24, 22, 0.12)' },
    ios: {
      shadowColor: '#0F1715',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
    default: {},
  }) as ViewStyle,
} as const;

/** Content is centred and constrained on tablets and on web. */
export const layout = {
  maxContentWidth: 520,
} as const;
