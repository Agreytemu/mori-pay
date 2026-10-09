import { createContext } from 'react';

import type { ColorScheme, ColorTokens } from '@/theme/colors';

/** User-selectable appearance. `system` follows the OS setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

export type AppTheme = {
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  colors: ColorTokens;
};

export const AppThemeContext = createContext<AppTheme | null>(null);
