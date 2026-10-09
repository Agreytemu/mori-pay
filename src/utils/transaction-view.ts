import type { AppIconName } from '@/theme';
import type { Transaction } from '@/types/transaction';

/**
 * Presentation mapping for transaction records.
 *
 * Keeps category-to-icon and category-to-tone decisions in one place so the
 * ledger row, the filters and any future detail screen stay consistent.
 */
export type TransactionTone = 'brand' | 'info' | 'warning' | 'neutral';

const TYPE_ICONS: Record<Transaction['type'], AppIconName> = {
  send: 'moneyOut',
  receive: 'moneyIn',
  request: 'request',
  payment: 'card',
  deposit: 'bank',
  withdrawal: 'cashOut',
};

const TYPE_TONES: Record<Transaction['type'], TransactionTone> = {
  send: 'neutral',
  receive: 'brand',
  request: 'info',
  payment: 'info',
  deposit: 'brand',
  withdrawal: 'neutral',
};

export function getTransactionIcon(transaction: Transaction): AppIconName {
  return TYPE_ICONS[transaction.type];
}

export function getTransactionTone(transaction: Transaction): TransactionTone {
  return TYPE_TONES[transaction.type];
}
