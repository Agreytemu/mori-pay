/** Domain models for the wallet UI. Deliberately API-shaped so the temporary
 *  data in `src/data` can be swapped for real responses without touching the UI. */

export type TransactionType =
  | 'send'
  | 'receive'
  | 'payment'
  | 'request'
  | 'deposit'
  | 'withdrawal';

export type TransactionStatus =
  | 'completed'
  | 'processing'
  | 'pending'
  | 'failed'
  | 'cancelled';

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
  /** Signed minor-unit-free amount in the account's currency. */
  amount: number;
  currency: string;
  fee: number;
  feeFlat?: number;
  feePercentage?: number;
  /** Counterparty display name, or the merchant label for payments. */
  counterparty: string;
  /** Secondary line shown under the counterparty, e.g. phone number. */
  counterpartyDetail?: string;
  note?: string;
  direction: 'credit' | 'debit';
  /** ISO-8601 timestamp. */
  createdAt: string;
};

export type TransactionFilters = {
  query: string;
  types: TransactionType[];
  status: TransactionStatus | 'all';
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
  processing: 'Processing',
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

export const TRANSACTION_TYPE_OPTIONS: readonly {
  value: TransactionType | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'send', label: 'Sent' },
  { value: 'receive', label: 'Received' },
  { value: 'payment', label: 'Payments' },
  { value: 'request', label: 'Requests' },
  { value: 'deposit', label: 'Deposits' },
];

export const TRANSACTION_STATUS_OPTIONS: readonly {
  value: TransactionStatus | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'processing', label: 'Processing' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];