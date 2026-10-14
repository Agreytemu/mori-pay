/**
 * Abliner payment-provider contracts.
 * Docs: https://abliner.net/docs — all amounts are whole TZS integers.
 *
 * Abliner exposes one REST API (`https://abliner.net/api/v1`) authenticated
 * with a Bearer API key. Deposits additionally require an HMAC signature of
 * `${timestamp}.${rawBody}` (webhook secret) and an `Idempotency-Key` header.
 */

/** Mobile operators shown in the UI. Abliner auto-routes rails server-side. */
export const MOBILE_NETWORKS = [
  'Mpesa',
  'AirtelMoney',
  'TigoPesa',
  'HaloPesa',
] as const;

export type MobileNetwork = (typeof MOBILE_NETWORKS)[number];

/** Maps an operator-facing label to the human-readable network name. */
export const MOBILE_NETWORK_LABEL: Record<MobileNetwork, string> = {
  Mpesa: 'M-Pesa',
  AirtelMoney: 'Airtel Money',
  TigoPesa: 'Mixx by Yas',
  HaloPesa: 'HaloPesa',
};

/** Method accepted by `POST /api/v1/deposits`. */
export type AblinerDepositMethod = 'mobile' | 'card';

export type AblinerDepositRequest = {
  amount: number;
  method: AblinerDepositMethod;
  currency: 'TZS';
  /** Required when `method` is `mobile`. */
  phone?: string;
  /** Our reference, echoed back as `customer_reference`. */
  reference: string;
  callbackUrl?: string;
};

export type AblinerDepositData = {
  id: string;
  type: 'deposit' | 'checkout';
  flow: 'push' | 'hosted_page';
  status: AblinerTransactionStatus;
  amount: number;
  currency: string;
  method: string;
  /** Present for card/dynamic-qr collections; `null` for mobile pushes. */
  payment_url: string | null;
  /** Abliner's provider reference sent to the network. */
  reference: string;
  customer_reference?: string | null;
  message?: string;
};

export type AblinerWithdrawalRequest = {
  amount: number;
  method: 'mobile';
  currency: 'TZS';
  /** Recipient mobile-money number. */
  recipient: string;
  reference: string;
};

export type AblinerWithdrawalData = {
  id: string;
  status: AblinerTransactionStatus | 'processing';
  amount: number;
  currency: string;
  recipient?: string | null;
  reference?: string;
};

export type AblinerWithdrawalPreview = {
  amount_tzs: number;
  fee_tzs: number;
  total_debited_tzs: number;
};

export type AblinerLookupResult = {
  phone: string;
  name: string;
  network?: string;
};

export type AblinerTransactionStatus = 'pending' | 'completed' | 'failed';

/** A row from `GET /api/v1/transactions`. */
export type AblinerTransaction = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'checkout' | 'sms';
  method?: string | null;
  amount?: number;
  amount_cents?: number;
  currency: string;
  status: AblinerTransactionStatus;
  /** Reference returned by Abliner; list responses may use this for our reference. */
  reference: string;
  /** The `reference` we sent. */
  customer_reference?: string | null;
  idempotency_key?: string | null;
  provider_reference?: string | null;
  recipient?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type AblinerBalance = {
  balance: number;
  currency: string;
  balances: Record<string, number>;
};

export type AblinerWebhookEventType =
  | 'transaction.completed'
  | 'transaction.failed'
  | 'withdrawal.completed'
  | 'withdrawal.failed'
  | 'checkout.paid';

export type AblinerWebhookData = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'checkout';
  method?: string | null;
  amount: number;
  amount_cents?: number;
  currency: string;
  status: AblinerTransactionStatus;
  reference: string;
  customer_reference?: string | null;
  provider_reference?: string | null;
  recipient?: string | null;
  completed_at?: string | null;
  /** Present on `checkout.paid` events. */
  payer_account?: string;
  payer_name?: string;
  paid_at?: string;
};

export type AblinerWebhookPayload = {
  /** Stable event id (also sent as `x-webhook-id`). */
  id: string;
  event: AblinerWebhookEventType;
  created_at?: string;
  data: AblinerWebhookData;
};

/** Envelope returned by every Abliner endpoint. */
export type AblinerApiResponse<T> =
  | { status: 'success'; data: T }
  | {
      status: 'error';
      code: string;
      message: string;
      retryable?: boolean;
      field?: string;
      transaction_id?: string;
    };

/** Token returned by Abliner for signature/idempotency replay checks. */
export type AblinerIdempotentReplay = {
  idempotent_replay?: boolean;
};
