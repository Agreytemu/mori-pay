import type { Amount, Currency, Direction } from './money';

export type TransactionType =
  | 'send'
  | 'receive'
  | 'payment'
  | 'request'
  | 'deposit'
  | 'withdrawal';

export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

export type TransactionCategory =
  | 'person'
  | 'merchant'
  | 'utility'
  | 'transfer'
  | 'topUp';

export type TransactionChannel = 'wallet' | 'bank' | 'mobileMoney' | 'card';

export type Transaction = {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  category: TransactionCategory;
  channel: TransactionChannel;
  amount: Amount;
  currency: Currency;
  fee: Amount;
  /** Flat component of `fee`, when it was resolved from a fee rule. */
  feeFlat?: Amount;
  /** Percentage component of `fee` as a fraction (e.g. 0.02 = 2%). */
  feePercentage?: number;
  /** Counterparty display name, or the merchant label for payments. */
  counterparty: string;
  /** Secondary line shown under the counterparty, e.g. phone number. */
  counterpartyDetail?: string;
  note?: string;
  direction: Direction;
  /** ISO-8601 timestamp. */
  createdAt: string;
};

export type TransactionFilters = {
  query: string;
  types: TransactionType[];
  status: TransactionStatus | 'all';
};

export type Paginated<T> = {
  items: T[];
  /** Opaque cursor for the next page, or `null` when exhausted. */
  nextCursor: string | null;
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  send: 'Money sent',
  receive: 'Money received',
  payment: 'Payment',
  request: 'Money request',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
};

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  completed: 'Completed',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const TRANSACTION_CATEGORY_LABEL: Record<TransactionCategory, string> = {
  person: 'Person',
  merchant: 'Merchant',
  utility: 'Utility',
  transfer: 'Transfer',
  topUp: 'Top-up',
};
