import type { ThemePreference } from '@/theme';
import type { IconName } from '@/constants/icons';

/**
 * Central route map. Screens never hard-code href strings so a route rename is
 * a single-file change.
 */
export const ROUTES = {
  tabs: '/(tabs)',
  home: '/(tabs)',
  payments: '/(tabs)/payments',
  transactions: '/(tabs)/transactions',
  profile: '/(tabs)/profile',
} as const;

export type TabRouteName = 'index' | 'payments' | 'transactions' | 'profile';

export type TabDefinition = {
  /** File name inside `src/app/(tabs)`. */
  name: TabRouteName;
  /** Value passed to `Tabs.Screen options.title`. */
  title: string;
  route: (typeof ROUTES)[keyof typeof ROUTES];
  icon: IconName;
  iconOutline: IconName;
  /** Short label used under the icon; shortens on compact screens. */
  label: string;
};

export const TABS: readonly TabDefinition[] = [
  {
    name: 'index',
    title: 'Home',
    route: ROUTES.home,
    icon: 'home',
    iconOutline: 'homeOutline',
    label: 'Home',
  },
  {
    name: 'payments',
    title: 'Payments',
    route: ROUTES.payments,
    icon: 'payments',
    iconOutline: 'paymentsOutline',
    label: 'Payments',
  },
  {
    name: 'transactions',
    title: 'Transactions',
    route: ROUTES.transactions,
    icon: 'transactions',
    iconOutline: 'transactionsOutline',
    label: 'Activity',
  },
  {
    name: 'profile',
    title: 'Profile',
    route: ROUTES.profile,
    icon: 'profile',
    iconOutline: 'profileOutline',
    label: 'Profile',
  },
] as const;

export type AppearanceOption = {
  value: ThemePreference;
  label: string;
  icon: IconName;
};

export const APPEARANCE_OPTIONS: readonly AppearanceOption[] = [
  { value: 'light', label: 'Light', icon: 'appearanceLight' },
  { value: 'dark', label: 'Dark', icon: 'appearanceDark' },
  { value: 'system', label: 'System', icon: 'appearanceSystem' },
] as const;