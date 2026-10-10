import type { PaymentMethod } from '@/data/payment-data';

export type SavedPaymentMethod = {
  id: string;
  kind: 'mobile-money' | 'bank' | 'card';
  name: string;
  provider: string;
  identifier: string;
  addedDate: string;
  status: 'Active' | 'Pending';
  isDefault: boolean;
};

export const PAYMENT_METHOD_TYPES: readonly PaymentMethod[] = [
  { id: 'mobile-money', name: 'Mobile Money', description: 'Link a mobile wallet', icon: 'phone' },
  { id: 'bank', name: 'Bank Account', description: 'Use a bank account', icon: 'payments' },
  { id: 'card', name: 'Card', description: 'Debit or credit card', icon: 'payments' },
];
