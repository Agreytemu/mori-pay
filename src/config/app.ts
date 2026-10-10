import Constants from 'expo-constants';

/**
 * Single source of truth for app-level branding and defaults.
 *
 * Change the product name, tagline or default currency here and the change
 * propagates to headers, about rows, splash branding and every screen.
 */
export const APP_NAME = 'Mori Pay';

export const APP_TAGLINE = 'Pay anyone. Anytime. From anywhere in Tanzania.';

export const APP_SHORT_DESCRIPTION = 'Mobile payments made simple for Tanzania.';

/** ISO 4217 code used for formatting until a live account currency is known. */
export const DEFAULT_CURRENCY = 'TZS';

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export const SUPPORT = {
  email: 'support@moripay.co.tz',
  phone: '+255 700 000 000',
  hours: 'Mon – Sun, 07:00 – 22:00 EAT',
} as const;

export const LEGAL = {
  termsLabel: 'Terms of Service',
  privacyLabel: 'Privacy Policy',
  versionLabel: `Version ${APP_VERSION}`,
} as const;
