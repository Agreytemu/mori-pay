import { Platform, type TextStyle } from 'react-native';

export const fontFamily = {
  sans: Platform.select({
    ios: 'system-ui',
    default: 'sans-serif',
    web: 'var(--font-display)',
  }) as string,
  medium: Platform.select({
    ios: 'system-ui',
    default: 'sans-serif-medium',
    web: 'var(--font-display)',
  }) as string,
  mono: Platform.select({
    ios: 'ui-monospace',
    default: 'monospace',
    web: 'var(--font-mono)',
  }) as string,
} as const;

/**
 * Type ramp. Sizes are deliberately restrained (13–34) so the app stays legible
 * on 5" Android handsets without horizontal overflow.
 */
export const fontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 30,
  hero: 34,
} as const;

/** Numeric columns use tabular figures so amounts align vertically. */
const tabular = { fontVariant: ['tabular-nums' as const] };

export const typography = {
  /** Greeting / screen headline. */
  display: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.display,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
  } satisfies TextStyle,
  /** Card headline, e.g. section title. */
  title1: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  } satisfies TextStyle,
  title2: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.2,
  } satisfies TextStyle,
  title3: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: 21,
    fontWeight: '600',
  } satisfies TextStyle,
  /** Default body copy. */
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    lineHeight: 22,
    fontWeight: '400',
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: 22,
    fontWeight: '600',
  } satisfies TextStyle,
  bodySmall: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: 19,
    fontWeight: '400',
  } satisfies TextStyle,
  bodySmallStrong: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: 19,
    fontWeight: '600',
  } satisfies TextStyle,
  /** All-caps micro label above groups of content. */
  overline: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  /** Primary balance figure. */
  amountHero: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.hero,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1,
    ...tabular,
  } satisfies TextStyle,
  amount: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: 21,
    fontWeight: '600',
    ...tabular,
  } satisfies TextStyle,
  amountSmall: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: 20,
    fontWeight: '600',
    ...tabular,
  } satisfies TextStyle,
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: 19,
    fontWeight: '500',
  } satisfies TextStyle,
  /** Button labels. */
  button: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.1,
  } satisfies TextStyle,
  buttonSmall: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: 18,
    fontWeight: '600',
  } satisfies TextStyle,
  /** Tab bar labels. */
  tabLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  } satisfies TextStyle,
  /** Balance card heading. */
  cardLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.2,
  } satisfies TextStyle,
} as const;

export type TypographyVariant = keyof typeof typography;