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

export type Theme = {
  scheme: ColorScheme;
  /** `true` when the user has pinned the appearance, overriding the OS. */
  isOverridden: boolean;
  preference: ThemePreference;
  colors: ColorTokens;
  space: typeof space;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  layout: typeof layout;
  typography: typeof typography;
  /** `true` on short/narrow viewports, e.g. small Android handsets. */
  isCompact: boolean;
  /** Page gutter that respects the current viewport. */
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
    const toggleColorScheme = () =>
      setPreference(scheme === 'dark' ? 'light' : 'dark');

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

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside <ThemeProvider>.');
  }
  return context;
}

/**
 * Picks a `{ foreground, background, border }` triple for a semantic state.
 * Used by `StatusBadge`, inline banners and tinted icon tiles so state colours
 * are never written inline at the call site.
 */
export type StateTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'primary';

export function useStateTone(tone: StateTone) {
  const { colors } = useAppTheme();

  return useMemo(() => {
    switch (tone) {
      case 'success':
        return {
          foreground: colors.success,
          background: colors.successSoft,
          border: colors.successBorder,
        };
      case 'warning':
        return {
          foreground: colors.warning,
          background: colors.warningSoft,
          border: colors.warningBorder,
        };
      case 'error':
        return {
          foreground: colors.error,
          background: colors.errorSoft,
          border: colors.errorBorder,
        };
      case 'info':
        return { foreground: colors.info, background: colors.infoSoft, border: colors.infoBorder };
      case 'primary':
        return {
          foreground: colors.primary,
          background: colors.primarySoft,
          border: colors.primary,
        };
      case 'neutral':
      default:
        return {
          foreground: colors.textSecondary,
          background: colors.surfaceMuted,
          border: colors.border,
        };
    }
  }, [tone, colors]);
}

/** Convenience accessor for a typography variant with an override style. */
export function useTextStyle(variant: TypographyVariant) {
  const { typography } = useAppTheme();
  return typography[variant];
}

/** Stable press-handler helper for components that only need the boolean. */
export function usePressOpacity() {
  return useCallback(
    (pressed: boolean) => ({
      opacity: pressed ? 0.62 : 1,
    }),
    []
  );
}