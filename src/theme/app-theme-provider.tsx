import '@/global.css';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useWindowDimensions } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColorTokens, type ColorScheme, type ColorTokens } from '@/theme/colors';
import { borderWidth, layout, radius, space } from '@/theme/spacing';
import { typography, type TypographyVariant } from '@/theme/typography';

export type ThemePreference = 'system' | 'light' | 'dark';
export type StateTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'primary';

export type Theme = {
  scheme: ColorScheme;
  isOverridden: boolean;
  preference: ThemePreference;
  colors: ColorTokens;
  space: typeof space;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  layout: typeof layout;
  typography: typeof typography;
  isCompact: boolean;
  screenPadding: number;
};

type ThemeContextValue = Theme & {
  setPreference: (preference: ThemePreference) => void;
  toggleColorScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const isCompact = width < layout.compactWidthBreakpoint;

  const value = useMemo<ThemeContextValue>(() => {
    const toggleColorScheme = () => setPreference(scheme === 'dark' ? 'light' : 'dark');

    return {
      scheme,
      preference,
      isOverridden: preference !== 'system',
      colors: getColorTokens(scheme),
      space,
      radius,
      borderWidth,
      layout,
      typography,
      isCompact,
      screenPadding: isCompact ? layout.screenPaddingCompact : layout.screenPadding,
      setPreference,
      toggleColorScheme,
    };
  }, [scheme, preference, isCompact]);

  return createElement(ThemeContext.Provider, { value }, children);
}

export const AppThemeProvider = ThemeProvider;

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside <ThemeProvider>.');
  }
  return context;
}

export function useStateTone(tone: StateTone) {
  const { colors } = useAppTheme();

  return useMemo(() => {
    switch (tone) {
      case 'success':
        return { foreground: colors.success, background: colors.successSoft, border: colors.successBorder };
      case 'warning':
        return { foreground: colors.warning, background: colors.warningSoft, border: colors.warningBorder };
      case 'error':
        return { foreground: colors.error, background: colors.errorSoft, border: colors.errorBorder };
      case 'info':
        return { foreground: colors.info, background: colors.infoSoft, border: colors.infoBorder };
      case 'primary':
        return { foreground: colors.primary, background: colors.primarySoft, border: colors.primary };
      default:
        return { foreground: colors.textSecondary, background: colors.surfaceMuted, border: colors.border };
    }
  }, [tone, colors]);
}

export function useTextStyle(variant: TypographyVariant) {
  return useAppTheme().typography[variant];
}

export function usePressOpacity() {
  return useCallback((pressed: boolean) => ({ opacity: pressed ? 0.62 : 1 }), []);
}

export const tokens = { space, radius, borderWidth, layout, typography } as const;
