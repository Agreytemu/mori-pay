import {
  brand,
  caution,
  critical,
  informational,
  neutral,
  positive,
} from '@/theme/palette';

export type ColorScheme = 'light' | 'dark';

/**
 * Semantic colour tokens. Every colour a component is allowed to use is listed
 * here exactly once per scheme.
 */
export type ColorTokens = {
  /** App canvas behind all content. */
  background: string;
  /** Slightly recessed canvas (screens behind modals, inline wells). */
  backgroundSunken: string;
  /** Primary card / sheet surface. */
  surface: string;
  /** Secondary surface used for nested blocks inside a card. */
  surfaceMuted: string;
  /** Surface used for pressed / selected rows. */
  surfacePressed: string;
  /** Surface for the brand-coloured balance card and primary buttons. */
  primary: string;
  /** Pressed state for `primary` surfaces. */
  primaryPressed: string;
  /** Low-emphasis brand fill (chips, tinted icons, soft buttons). */
  primarySoft: string;
  /** Text/icon colour that sits on `primary`. */
  onPrimary: string;

  border: string;
  borderStrong: string;
  /** Divider inside lists. */
  divider: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Text on inverted (dark) surfaces such as the balance card. */
  textInverse: string;
  textInverseSecondary: string;
  link: string;

  success: string;
  successSoft: string;
  successBorder: string;

  warning: string;
  warningSoft: string;
  warningBorder: string;

  error: string;
  errorSoft: string;
  errorBorder: string;

  info: string;
  infoSoft: string;
  infoBorder: string;

  /** Tab bar / navigation chrome. */
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;

  /** Screen overlay behind modals. */
  overlay: string;
  /** Skeleton / placeholder block. */
  skeleton: string;
};

const light: ColorTokens = {
  background: neutral[50],
  backgroundSunken: neutral[100],
  surface: neutral[0],
  surfaceMuted: neutral[100],
  surfacePressed: neutral[200],

  primary: brand[600],
  primaryPressed: brand[700],
  primarySoft: brand[50],
  onPrimary: neutral[0],

  border: neutral[200],
  borderStrong: neutral[300],
  divider: neutral[200],

  text: neutral[900],
  textSecondary: neutral[600],
  textTertiary: neutral[500],
  textInverse: neutral[0],
  textInverseSecondary: 'rgba(255, 255, 255, 0.76)',
  link: brand[600],

  success: positive[600],
  successSoft: positive[50],
  successBorder: '#BFE5CD',

  warning: caution[600],
  warningSoft: caution[50],
  warningBorder: '#F2D8AE',

  error: critical[600],
  errorSoft: critical[50],
  errorBorder: '#F3C7C2',

  info: informational[600],
  infoSoft: informational[50],
  infoBorder: '#C4D3F7',

  tabBarBackground: neutral[0],
  tabBarBorder: neutral[200],
  tabBarActive: brand[600],
  tabBarInactive: neutral[500],

  overlay: 'rgba(10, 14, 20, 0.45)',
  skeleton: neutral[200],
};

const dark: ColorTokens = {
  background: neutral[950],
  backgroundSunken: '#070A0F',
  surface: neutral[900],
  surfaceMuted: neutral[850],
  surfacePressed: neutral[800],

  primary: brand[300],
  primaryPressed: brand[200],
  primarySoft: 'rgba(52, 165, 150, 0.16)',
  onPrimary: neutral[950],

  border: '#232B36',
  borderStrong: '#333D4A',
  divider: '#212832',

  text: '#F1F4F8',
  textSecondary: '#9BA6B4',
  textTertiary: '#6F7B8B',
  textInverse: neutral[950],
  textInverseSecondary: 'rgba(8, 20, 19, 0.72)',
  link: brand[300],

  success: '#4FBE7E',
  successSoft: 'rgba(30, 142, 78, 0.16)',
  successBorder: 'rgba(79, 190, 126, 0.34)',

  warning: '#E0A94B',
  warningSoft: 'rgba(194, 118, 12, 0.18)',
  warningBorder: 'rgba(224, 169, 75, 0.34)',

  error: '#F0756A',
  errorSoft: 'rgba(196, 52, 42, 0.18)',
  errorBorder: 'rgba(240, 117, 106, 0.34)',

  info: '#7C9CF5',
  infoSoft: 'rgba(43, 95, 217, 0.18)',
  infoBorder: 'rgba(124, 156, 245, 0.34)',

  tabBarBackground: neutral[900],
  tabBarBorder: '#232B36',
  tabBarActive: brand[300],
  tabBarInactive: neutral[400],

  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: neutral[800],
};

export const colors: Record<ColorScheme, ColorTokens> = { light, dark };

export function getColorTokens(scheme: ColorScheme): ColorTokens {
  return colors[scheme];
}