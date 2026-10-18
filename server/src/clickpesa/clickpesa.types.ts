export type ClickPesaPaymentStatus =
  | 'SUCCESS'
  | 'SETTLED'
  | 'PROCESSING'
  | 'PENDING'
  | 'FAILED';

export type ClickPesaPayment = {
  id: string;
  status: ClickPesaPaymentStatus;
  orderReference: string;
  paymentReference?: string;
  collectedAmount?: number | string;
  collectedCurrency?: string;
  paymentPhoneNumber?: string;
  message?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ClickPesaUssdPushPreview = {
  activeMethods: Array<{
    name: string;
    status: 'AVAILABLE' | 'UNAVAILABLE';
    fee?: number;
    message?: string;
  }>;
  sender?: {
    accountName?: string;
    accountNumber?: string;
    accountProvider?: string;
  };
};

export type ClickPesaPayoutStatus =
  | 'AUTHORIZED'
  | 'PROCESSING'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED'
  | 'REVERSED';

export type ClickPesaPayout = {
  id: string;
  orderReference: string;
  status: ClickPesaPayoutStatus;
  amount?: number | string;
  currency?: string;
  channel?: string;
  channelProvider?: string;
  fee?: number | string;
  receiver?: {
    accountName?: string;
    accountNumber?: string;
    accountProvider?: string;
  };
};

export type ClickPesaPayoutPreview = {
  recipientName?: string;
  fee?: number | string;
  balance?: number | string;
  channelProvider?: string;
};

export type ClickPesaBank = {
  name: string;
  bic: string;
};

export type ClickPesaWebhookInput = {
  event: string;
  data: Record<string, unknown>;
  checksum?: string;
  checksumMethod?: string;
  [key: string]: unknown;
};
