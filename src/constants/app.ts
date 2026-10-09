/**
 * Centralised application identity. Screens and components read the product
 * name from here instead of hard-coding it.
 */
export const APP = {
  name: 'Mori Pay',
  /** Latin transliteration used for legal copy and deep links. */
  latinName: 'Mori Pay',
  tagline: 'Pay with your number',
  shortTagline: 'Pay with your number',
  description: 'Move money with your phone number, from anywhere.',
  supportEmail: 'support@moripay.co.tz',
  supportPhone: '+255 700 000 000',
  version: '1.0.0',
  buildLabel: 'Milestone 1 · UI foundation',
} as const;

/** Copy shown in the About section. */
export const ABOUT_COPY = {
  legal: `© ${new Date().getFullYear()} ${APP.name}. All rights reserved.`,
  terms: 'Terms of service',
  privacy: 'Privacy policy',
  licences: 'Open-source licences',
} as const;