/**
 * Profile, security, device and settings fixtures.
 *
 * Types describe the shape an account API would return later; the exported
 * `MOCK_*` values are the only thing the UI is allowed to read today. Swap the
 * fixtures for a fetch in `profile-store` and nothing else has to change.
 */
import type { IconName } from '@/constants/icons';

export type ProfileStatus = 'verified' | 'pending' | 'restricted';

export type UserProfile = {
  id: string;
  /** Human-facing member number, e.g. `MOR-4821-0098`. */
  memberId: string;
  fullName: string;
  /** Digits only, no `+` or spaces. */
  phone: string;
  email: string;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string;
  status: ProfileStatus;
  tier: string;
  joinedAt: string;
};

export type SecurityStatus = 'protected' | 'attention';

export type SecuritySettings = {
  status: SecurityStatus;
  /** UI only. No biometrics prompt is ever shown in this build. */
  biometricsEnabled: boolean;
  loginAlertsEnabled: boolean;
  lastCheckedAt: string;
};

export type DevicePlatform = 'android' | 'ios' | 'web';

export type TrustedDevice = {
  id: string;
  name: string;
  platform: DevicePlatform;
  location: string;
  /** ISO timestamp. */
  lastActiveAt: string;
  isCurrent: boolean;
};

export type SecurityActivityTone = 'success' | 'warning' | 'info';

export type SecurityActivity = {
  id: string;
  title: string;
  detail: string;
  /** ISO timestamp. */
  at: string;
  icon: IconName;
  tone: SecurityActivityTone;
};

export type NotificationPreferenceKey =
  | 'payments'
  | 'transactions'
  | 'securityAlerts'
  | 'promotions';

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export type AppLanguage = 'en' | 'sw';

export type FaqCategory = 'payments' | 'account' | 'security' | 'general';

export type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export type SupportCategory = {
  id: FaqCategory;
  title: string;
  description: string;
  icon: IconName;
};

export type ReportCategory = 'payment' | 'account' | 'security' | 'other';

export type LegalSection = {
  id: 'terms' | 'privacy' | 'licences';
  title: string;
  icon: IconName;
  body: string;
};

export const MOCK_PROFILE: UserProfile = {
  id: 'usr-0004821',
  memberId: 'MOR-4821-0098',
  fullName: 'Agrey Temu',
  phone: '255712345678',
  email: 'agrey.temu@example.co.tz',
  dateOfBirth: '1996-04-18',
  status: 'verified',
  tier: 'Personal account',
  joinedAt: '2025-11-04',
};

export const MOCK_SECURITY: SecuritySettings = {
  status: 'protected',
  biometricsEnabled: false,
  loginAlertsEnabled: true,
  lastCheckedAt: '2026-10-04T07:12:00',
};

/**
 * Demo-only PIN. It exists so the change-PIN screen can demonstrate both the
 * "wrong current PIN" and "updated" states. It is never persisted and never
 * authorises anything.
 */
export const MOCK_CURRENT_PIN = '4821';

export const MOCK_TRUSTED_DEVICES: readonly TrustedDevice[] = [
  {
    id: 'dev-current',
    name: 'Samsung Galaxy A16',
    platform: 'android',
    location: 'Dar es Salaam, Tanzania',
    lastActiveAt: '2026-10-05T09:12:00',
    isCurrent: true,
  },
  {
    id: 'dev-chrome',
    name: 'Chrome on Windows',
    platform: 'web',
    location: 'Dar es Salaam, Tanzania',
    lastActiveAt: '2026-10-02T19:41:00',
    isCurrent: false,
  },
  {
    id: 'dev-infinix',
    name: 'Infinix Hot 30',
    platform: 'android',
    location: 'Mwanza, Tanzania',
    lastActiveAt: '2026-09-27T06:58:00',
    isCurrent: false,
  },
];

export const MOCK_SECURITY_ACTIVITY: readonly SecurityActivity[] = [
  {
    id: 'act-1',
    title: 'Signed in on a new device',
    detail: 'Chrome on Windows · Dar es Salaam',
    at: '2026-10-02T19:41:00',
    icon: 'devices',
    tone: 'warning',
  },
  {
    id: 'act-2',
    title: 'PIN changed successfully',
    detail: 'Changed from the Android app',
    at: '2026-09-30T11:05:00',
    icon: 'pin',
    tone: 'success',
  },
  {
    id: 'act-3',
    title: 'Payment method added',
    detail: 'M-Pesa ending in 4821',
    at: '2026-09-24T16:22:00',
    icon: 'payments',
    tone: 'info',
  },
  {
    id: 'act-4',
    title: 'Biometric prompt disabled',
    detail: 'Fingerprint unlock turned off',
    at: '2026-09-18T08:30:00',
    icon: 'biometrics',
    tone: 'info',
  },
];

export const MOCK_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  payments: true,
  transactions: true,
  securityAlerts: true,
  promotions: false,
};

export const APP_LANGUAGES: Record<AppLanguage, string> = {
  en: 'English',
  sw: 'Kiswahili',
};

export const MOCK_SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  {
    id: 'payments',
    title: 'Payment issues',
    description: 'Failed, pending or reversed payments',
    icon: 'payments',
  },
  {
    id: 'account',
    title: 'Account issues',
    description: 'Verification, limits and statements',
    icon: 'id',
  },
  {
    id: 'security',
    title: 'Security issues',
    description: 'Suspicious activity and PIN safety',
    icon: 'security',
  },
  {
    id: 'general',
    title: 'Using the app',
    description: 'Navigation, statements and settings',
    icon: 'help',
  },
];

export const MOCK_REPORT_CATEGORIES: readonly { id: ReportCategory; label: string }[] = [
  { id: 'payment', label: 'Payment issue' },
  { id: 'account', label: 'Account issue' },
  { id: 'security', label: 'Security issue' },
  { id: 'other', label: 'Something else' },
];

export const MOCK_FAQS: readonly Faq[] = [
  {
    id: 'faq-1',
    category: 'payments',
    question: 'Why did my payment fail?',
    answer:
      'A payment can fail when the balance is below the amount plus fee, the daily limit is reached, or the recipient number is not registered. Failed amounts are never left in your wallet.',
  },
  {
    id: 'faq-2',
    category: 'payments',
    question: 'How long does a payment take to arrive?',
    answer:
      'Payments to a mobile wallet are instant. Bank transfers usually settle within one business day, and the receipt in your transaction list shows the current status.',
  },
  {
    id: 'faq-3',
    category: 'payments',
    question: 'Can I cancel a pending payment?',
    answer:
      'Yes. Open the payment from your transaction list and choose Cancel while the status is still Pending. Once the status is Completed the transfer cannot be reversed from the app.',
  },
  {
    id: 'faq-4',
    category: 'account',
    question: 'Where do I find my account number?',
    answer:
      'The account card on Home and the Wallet screen show the last four digits. Your full member number appears under Profile to Personal information.',
  },
  {
    id: 'faq-5',
    category: 'account',
    question: 'How do I update my phone number or email?',
    answer:
      'Open Personal information and use Edit information. Changes are kept on this device in the current prototype and are reviewed once account services are connected.',
  },
  {
    id: 'faq-6',
    category: 'security',
    question: 'What should I do if I see an unfamiliar login?',
    answer:
      'Change your PIN from Security, remove the unknown device under Trusted devices, and turn on security alerts so you are notified the next time someone signs in.',
  },
  {
    id: 'faq-7',
    category: 'security',
    question: 'Is biometric authentication available?',
    answer:
      'The biometric switch is part of the interface only in this release. It records your preference and does not yet read the fingerprint sensor on the device.',
  },
  {
    id: 'faq-8',
    category: 'general',
    question: 'How do I switch the app theme?',
    answer:
      'Open Settings, then choose Light, Dark or System default under Appearance. The change applies immediately across every screen.',
  },
];

export const MOCK_LEGAL_SECTIONS: readonly LegalSection[] = [
  {
    id: 'terms',
    title: 'Terms of service',
    icon: 'receipt',
    body:
      'These terms describe how the account may be used. Keep your PIN private, confirm every payment before approving it, and report anything unfamiliar to support within 24 hours. Balances shown in the app reflect settled transactions only.',
  },
  {
    id: 'privacy',
    title: 'Privacy policy',
    icon: 'security',
    body:
      'Personal information is used to operate the wallet, keep the account secure and send the notifications you enable. Nothing in this build leaves the device: profile, security and device data are stored locally.',
  },
  {
    id: 'licences',
    title: 'Open-source licences',
    icon: 'about',
    body:
      'Built with Expo and React Native. Icons are rendered from SF Symbols on iOS and Material Symbols on Android.',
  },
];