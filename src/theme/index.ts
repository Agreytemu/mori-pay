import { typography as metricTypography } from '@/theme/metrics';
import { typography as appTypography } from '@/theme/typography';

export {
  AppThemeProvider,
  ThemeProvider,
  tokens,
  useAppTheme,
  usePressOpacity,
  useStateTone,
  useTextStyle,
} from '@/theme/app-theme-provider';
export type { StateTone, Theme, ThemePreference } from '@/theme/app-theme-provider';
export { colors, getColorTokens } from '@/theme/colors';
export type { ColorScheme, ColorTokens } from '@/theme/colors';
export { appIcons, iconWeights } from '@/theme/icons';
export type { AppIconName, AppIconWeight } from '@/theme/icons';
export { borderWidth, layout, radius, space } from '@/theme/spacing';
export { gutter, hitTarget, numericText, shadows, spacing } from '@/theme/metrics';
export { fontFamily, fontSize } from '@/theme/typography';

export const typography = { ...metricTypography, ...appTypography };
export type TypographyVariant = keyof typeof typography;
