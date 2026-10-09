import type { PaymentMethod } from '@/data/payment-data';

export type SavedPaymentMethod = {
  id: string;
  kind: PaymentMethod['id'];
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

export const MOCK_SAVED_PAYMENT_METHODS: readonly SavedPaymentMethod[] = [
  {
    id: 'method-mpesa',
    kind: 'mobile-money',
    name: 'M-Pesa',
    provider: 'M-Pesa',
    identifier: '•••• 4821',
    addedDate: '12 February 2026',
    status: 'Active',
    isDefault: true,
  },
  {
    id: 'method-airtel',
    kind: 'mobile-money',
    name: 'Airtel Money',
    provider: 'Airtel Money',
    identifier: '•••• 1937',
    addedDate: '28 January 2026',
    status: 'Active',
    isDefault: false,
  },
  {
    id: 'method-bank',
    kind: 'bank',
    name: 'Bank Account',
    provider: 'NMB Bank',
    identifier: '•••• 7412',
    addedDate: '05 January 2026',
    status: 'Active',
    isDefault: false,
  },
];
