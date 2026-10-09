/**
 * Stakaba payment provider contracts.
 * Docs: https://docs.stakaba.com — all amounts are whole TZS integers.
 */

export const STAKABA_NETWORKS = [
  'Mpesa',
  'AirtelMoney',
  'TigoPesa',
  'HaloPesa',
] as const;

export type StakabaNetwork = (typeof STAKABA_NETWORKS)[number];

/** Maps an operator-facing label to the case-sensitive Stakaba `network` value. */
export const STAKABA_NETWORK_LABEL: Record<StakabaNetwork, string> = {
  Mpesa: 'M-Pesa',
  AirtelMoney: 'Airtel Money',
  TigoPesa: 'Mixx by Yas',
  HaloPesa: 'HaloPesa',
};

export type StakabaCollectionRequest = {
  grossAmount: number;
  currency: 'TZS';
  mobileNumber: string;
  network: StakabaNetwork;
  metadata?: Record<string, unknown>;
};

export type StakabaCollectionResponse = {
  internalReference: string;
};

export type StakabaCardPaymentRequest = {
  grossAmount: number;
  currency: 'TZS';
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  billingAddress?: string;
  postalCode?: string;
  metadata?: Record<string, unknown>;
};

export type StakabaCardPaymentResponse = {
  checkoutUrl: string;
  internalReference: string;
};

export type StakabaPayoutRequest = {
  amount: number;
  currency: 'TZS';
  destinationType: 'mobile_money';
  destinationDetails: {
    phoneNumber: string;
    network: StakabaNetwork;
    accountName?: string;
  };
};

export type StakabaPayoutStatus =
  | 'completed'
  | 'processing'
  | 'failed'
  | 'pending_review';

export type StakabaPayoutResponse = {
  disbursement: {
    id: string;
    status: StakabaPayoutStatus;
    amount: number;
    currency: 'TZS';
  };
};

export type StakabaWebhookEventType =
  | 'transaction.success'
  | 'transaction.failed';

export type StakabaWebhookPayload = {
  event: StakabaWebhookEventType;
  internalReference: string;
  status: 'SUCCESS' | 'FAILED';
  type: 'COLLECTION' | 'PAYOUT' | 'CARD';
  grossAmount: number;
  stakabaFee: number;
  netAmount: number;
  currency: 'TZS';
  mobileNumber: string;
  network: StakabaNetwork;
  providerReference: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
