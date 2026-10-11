export type WalletAccount = {
  id: string;
  /** Full name of the account holder. */
  fullName: string;
  /** Short name used in greetings. */
  firstName: string;
  phoneNumber: string;
  /** Masked wallet/account identifier shown on the balance card. */
  accountNumber: string;
  /** Masked national ID. */
  nationalId: string;
  email: string;
  tier: 'Standard' | 'Verified';
  memberSince: string;
  currency: string;
  balance: {
    available: number;
    pending: number;
    /** Amount still free within the daily transfer ceiling. */
    dailyLimitRemaining: number;
    dailyLimit: number;
  };
};

export type SecurityState = {
  pinSet: boolean;
  appLockEnabled: boolean;
  twoFactorEnabled: boolean;
  /** Masked phone used for one-time codes. */
  recoveryPhone: string;
};

export type NotificationPreference = {
  transactions: boolean;
  moneyIn: boolean;
  moneyOut: boolean;
  marketing: boolean;
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
};