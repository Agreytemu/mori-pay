/**
 * TEMPORARY FRONTEND DATA — milestone 1.
 *
 * Nothing in `src/data` is used at runtime by a future backend. Every value here
 * is local placeholder data so the UI can be built and reviewed first.
 *
 * When the API lands:
 *   1. Delete `getMockAccount()` / `getMockTransactions()` / `getMockNotifications()`.
 *   2. Replace call sites with a hook (e.g. `useAccount()`), keeping the
 *      `WalletAccount` / `Transaction` / `AppNotification` types in `src/types`
 *      as the response contract.
 * Screens must not change: they already read only from these types.
 */

import type {
  AppNotification,
  NotificationPreference,
  SecurityState,
  WalletAccount,
} from '@/types';

let tick = 0;
const nextTick = () => ++tick;

export function getMockAccount(): WalletAccount {
  const now = Date.now();

  return {
    id: `acct_${nextTick()}`,
    fullName: 'Agrey Albert Moses',
    firstName: 'Agrey',
    phoneNumber: '255712345678',
    accountNumber: '•••• 4821',
    nationalId: '1998•••••••4127',
    email: 'agrey.moses@example.co.tz',
    tier: 'Verified',
    memberSince: new Date(now - 1000 * 60 * 60 * 24 * 620).toISOString(),
    currency: 'TZS',
    balance: {
      available: 486_500,
      pending: 62_000,
      dailyLimitRemaining: 1_413_500,
      dailyLimit: 2_000_000,
    },
  };
}

export function getMockSecurityState(): SecurityState {
  return {
    pinSet: true,
    biometricsEnabled: false,
    twoFactorEnabled: false,
    recoveryPhone: '255712•••678',
  };
}

export function getMockNotificationPreferences(): NotificationPreference {
  return {
    transactions: true,
    moneyIn: true,
    moneyOut: true,
    marketing: false,
  };
}

export function getMockNotifications(): AppNotification[] {
  const now = Date.now();
  const minutes = (n: number) => new Date(now - n * 60_000).toISOString();

  return [
    {
      id: 'ntf_01',
      kind: 'transaction',
      title: 'Payment received',
      body: 'You received TZS 150,000 from Neema Joseph.',
      createdAt: minutes(12),
      read: false,
      transactionId: 'txn_004',
    },
    {
      id: 'ntf_02',
      kind: 'request',
      title: 'Money request approved',
      body: 'Albert Temu approved your request of TZS 40,000.',
      createdAt: minutes(95),
      read: false,
    },
    {
      id: 'ntf_03',
      kind: 'transaction',
      title: 'Airtime bundle delivered',
      body: 'TZS 5,000 airtime was delivered to 0754 221 908.',
      createdAt: minutes(420),
      read: true,
    },
    {
      id: 'ntf_04',
      kind: 'security',
      title: 'New device signed in',
      body: 'A sign-in from Dar es Salaam was recorded on your account.',
      createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
      read: true,
    },
  ];
}