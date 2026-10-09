/**
 * TEMPORARY FRONTEND DATA for the Home dashboard.
 * Replace this adapter with account and transaction hooks when APIs are added.
 */

import { getMockTransactions } from '@/data/mock-transactions';
import type { IconName } from '@/constants/icons';
import { TRANSACTION_TYPE_LABEL } from '@/types';

export const HOME_ACTIONS: {
  icon: IconName;
  label: string;
  description: string;
}[] = [
  { icon: 'send', label: 'Send', description: 'Send to a person or wallet' },
  { icon: 'receive', label: 'Receive', description: 'Share your payment details' },
  { icon: 'pay', label: 'Pay', description: 'Pay a bill or merchant' },
  { icon: 'request', label: 'Request', description: 'Request from someone' },
];

export function getMockHomeData() {
  return {
    user: {
      displayName: 'Agrey',
    },
    transactions: getMockTransactions()
      .slice(0, 4)
      .map((transaction) => ({
        ...transaction,
        typeLabel: TRANSACTION_TYPE_LABEL[transaction.type],
      })),
  };
}
