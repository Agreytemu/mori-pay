import type { IconName } from '@/constants/icons';

export type WalletAccountStatus = 'active' | 'pending' | 'limited';

export type WalletAccountData = {
  brand: string;
  accountType: string;
  availableBalance: number;
  currency: 'TZS';
  accountNumber: string;
  phoneNumber: string;
  openedDate: string;
  status: WalletAccountStatus;
};

export type WalletActivity = {
  id: string;
  description: string;
  date: string;
  amount: number;
  direction: 'credit' | 'debit';
  status: 'Completed' | 'Pending';
  icon: IconName;
};

export const WALLET_ACCOUNT: WalletAccountData = {
  brand: 'Mori Pay',
  accountType: 'Personal account',
  availableBalance: 486500,
  currency: 'TZS',
  accountNumber: '0092 3841 4821',
  phoneNumber: '+255 712 345 678',
  openedDate: '12 February 2024',
  status: 'active',
};

export const WALLET_ACTIVITY: readonly WalletActivity[] = [
  {
    id: 'activity-1',
    description: 'Money received',
    date: 'Today · 16:58',
    amount: 450000,
    direction: 'credit',
    status: 'Completed',
    icon: 'receive',
  },
  {
    id: 'activity-2',
    description: 'Chama contribution',
    date: 'Today · 15:05',
    amount: 75000,
    direction: 'debit',
    status: 'Pending',
    icon: 'send',
  },
  {
    id: 'activity-3',
    description: 'Water bill',
    date: 'Today · 10:30',
    amount: 32500,
    direction: 'debit',
    status: 'Completed',
    icon: 'pay',
  },
];
