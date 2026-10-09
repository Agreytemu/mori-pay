import { Platform } from 'react-native';

/** 4pt-based spacing ramp. */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 40,
  giant: 48,
} as const;

export const radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
  circle: 999,
} as const;

export const borderWidth = {
  hairline: Platform.select({ ios: 0.5, default: 1 }) as number,
  thin: 1,
  thick: 2,
} as const;

/**
 * Layout tokens. `screenPadding` shrinks on compact widths (small Android
 * phones, <360dp) so content never feels cramped or clipped.
 */
export const layout = {
  /** Horizontal page gutter. */
  screenPadding: 16,
  screenPaddingCompact: 12,
  /** Max comfortable reading width on tablets / web. */
  maxContentWidth: 560,
  /** Android accessibility minimum. */
  minTouchTarget: 44,
  /** Height of the in-screen `AppHeader`. */
  headerHeight: 56,
  /** Height of the icon tile inside list rows and quick actions. */
  iconTile: 44,
  iconTileSmall: 36,
  /** Height of the balance card. */
  balanceCardMinHeight: 168,
  /** Standard minimum height of a list row. */
  listRowMinHeight: 60,
  /** Width threshold below which compact spacing kicks in. */
  compactWidthBreakpoint: 360,
} as const;

export const hairlineWidth = borderWidth.hairline;