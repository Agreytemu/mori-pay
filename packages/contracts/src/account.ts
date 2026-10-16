import type { Amount, Currency } from './money';

export type AccountTier = 'Standard' | 'Verified';

export type WalletBalance = {
  available: Amount;
  pending: Amount;
  /** Amount still free within the daily transfer ceiling. */
  dailyLimitRemaining: Amount;
  dailyLimit: Amount;
};

export type WalletAccount = {
  id: string;
  /** Full name of the account holder. */
  fullName: string;
  /** Short name used in greetings. */
  firstName: string;
  phoneNumber: string | null;
  /** Masked wallet/account identifier shown on the balance card. */
  accountNumber: string;
  /** Masked national ID. */
  nationalId: string;
  email: string;
  tier: AccountTier;
  memberSince: string;
  currency: Currency;
  balance: WalletBalance;
};

export type UserStatus = 'active' | 'pending' | 'restricted';

export type AccountProfile = {
  id: string;
  memberId: string;
  fullName: string;
  firstName: string;
  phoneNumber: string | null;
  email: string | null;
  dateOfBirth: string | null;
  tier: AccountTier;
  kycLevel: number;
  status: UserStatus;
  memberSince: string;
  pinUpdatedAt: string | null;
};

export type SavedPaymentMethodKind = 'mobile-money' | 'bank' | 'card';

export type SavedPaymentMethod = {
  id: string;
  kind: SavedPaymentMethodKind;
  provider: string;
  /** Only the last four digits are ever accepted or returned. */
  lastFour: string;
  /** Whether this saved method can be used for a mobile-money deposit. */
  usableForDeposit: boolean;
  isDefault: boolean;
  status: string;
  createdAt: string;
};

export type SecurityState = {
  pinSet: boolean;
  biometricsEnabled: boolean;
  twoFactorEnabled: boolean;
  /** Masked phone used for one-time codes. */
  recoveryPhone: string;
};

export type NotificationPreference = {
  transactions: boolean;
  moneyIn: boolean;
  moneyOut: boolean;
  marketing: boolean;
  securityAlerts: boolean;
};

export type NotificationKind = 'transaction' | 'request' | 'security' | 'promotion';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** Transaction this notification relates to, when applicable. */
  transactionId?: string;
  transaction?: {
    status: string;
    direction: 'credit' | 'debit';
    amount: Amount;
    reference: string;
    counterparty: string;
  };
};
