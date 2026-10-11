import type { Amount, Currency } from './money';
import type { Transaction } from './transaction';

/** Internal (wallet-to-wallet, merchant and request) money movement. */

export type RecipientLookup = {
  found: boolean;
  phoneNumber: string;
  fullName?: string;
  firstName?: string;
};

export type TransferPreview = {
  recipient: RecipientLookup & { found: true };
  amount: Amount;
  fee: Amount;
  feePercentage: number;
  total: Amount;
  currency: Currency;
};

export type FeePreview = {
  amount: Amount;
  fee: Amount;
  feePercentage: number;
  total: Amount;
};

export type SendMoneyResult = {
  transaction: Transaction;
  recipientName: string;
  fee: Amount;
};

export type Merchant = {
  id: string;
  name: string;
  identifier: string;
  category: string;
  phoneNumber?: string;
};

export type PayMerchantResult = {
  transaction: Transaction;
  merchantName: string;
  fee: Amount;
};

export type MerchantPaymentPreview = {
  merchantName: string;
  amount: Amount;
  fee: Amount;
  feePercentage: number;
  total: Amount;
};

export type MoneyRequestStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export type MoneyRequestDirection = 'incoming' | 'outgoing';

export type MoneyRequest = {
  id: string;
  reference: string;
  amount: Amount;
  currency: Currency;
  note?: string;
  payerPhone: string;
  payerName?: string;
  requesterName: string;
  status: MoneyRequestStatus;
  direction: MoneyRequestDirection;
  createdAt: string;
  expiresAt?: string;
};

export type RequestMoneyResult = {
  request: MoneyRequest;
};

export type PayRequestResult = {
  request: MoneyRequest;
  transaction: Transaction;
  fee: Amount;
};

/** A pending top-up plus the instruction to show the user (e.g. "enter PIN"). */
export type TopupInitResult = {
  transaction: Transaction;
  instructions: string;
};

export type CardTopupResult = {
  transaction: Transaction;
  checkoutUrl: string;
};

export type WithdrawalResult = {
  transaction: Transaction;
  fee: Amount;
};

/**
 * A short-lived, server-signed per-user receive code. Rendered as a QR so a
 * payer can resolve it to the owner's account without exposing internal ids.
 */
export type ReceiveCode = {
  /** Opaque, tamper-proof code. Safe to encode in a QR or share as text. */
  code: string;
  /** ISO-8601 expiry; the code rotates and must be refreshed after this. */
  expiresAt: string;
};
