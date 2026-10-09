import type { AppIconName } from '@/theme';

/** Route names inside the `(tabs)` group. */
export type AppTabName = 'index' | 'payments' | 'transactions' | 'profile';

export type AppTabConfig = {
  name: AppTabName;
  label: string;
  icon: AppIconName;
  /** Short hint shown as the screen subtitle. */
  hint: string;
};

/**
 * Single declaration of the bottom navigation.
 *
 * The tab bar renders from this list, so adding a tab means editing one file.
 */
export const APP_TABS: readonly AppTabConfig[] = [
  { name: 'index', label: 'Home', icon: 'home', hint: 'Your balance at a glance' },
  { name: 'payments', label: 'Payments', icon: 'payments', hint: 'Send, request and pay' },
  { name: 'transactions', label: 'Transactions', icon: 'transactions', hint: 'Every movement on record' },
  { name: 'profile', label: 'Profile', icon: 'profile', hint: 'Account and preferences' },
];

export const APP_TABS_BY_NAME: Record<AppTabName, AppTabConfig> = APP_TABS.reduce(
  (accumulator, tab) => {
    accumulator[tab.name] = tab;
    return accumulator;
  },
  {} as Record<AppTabName, AppTabConfig>
);