import type {
  AblinerApiResponse,
  AblinerDepositData,
  AblinerTransaction,
  AblinerWebhookInput,
} from '@mori-pay/contracts';

export const depositRequestBodyFixture = {
  amount: 5_000,
  method: 'mobile',
  currency: 'TZS',
  phone: '255700000001',
  reference: 'DEP-TEST-1',
  callback_url: 'https://pay.example.com/api/v1/webhooks/abliner',
};

export const pendingDepositDataFixture: AblinerDepositData = {
  id: 'abl_tx_1',
  type: 'deposit',
  flow: 'push',
  status: 'pending',
  amount: 5_000,
  currency: 'TZS',
  method: 'mobile',
  payment_url: null,
  reference: 'ABLREF1',
  customer_reference: 'DEP-TEST-1',
};

export const pendingDepositResponseFixture: AblinerApiResponse<AblinerDepositData> =
  {
    status: 'success',
    data: pendingDepositDataFixture,
  };

export const completedTransactionFixture: AblinerTransaction = {
  id: 'abl_tx_1',
  type: 'deposit',
  method: 'mobile',
  amount: 5_000,
  currency: 'TZS',
  status: 'completed',
  reference: 'ABLREF1',
  customer_reference: 'DEP-TEST-1',
  created_at: '2026-10-11T10:00:00.000Z',
  completed_at: '2026-10-11T10:00:10.000Z',
};

export const completedWebhookFixture: AblinerWebhookInput = {
  id: 'evt_abl_tx_1',
  event: 'transaction.completed',
  created_at: '2026-10-11T10:00:10.000Z',
  data: {
    id: 'abl_tx_1',
    type: 'deposit',
    method: 'mobile',
    amount: 5_000,
    currency: 'TZS',
    status: 'completed',
    reference: 'ABLREF1',
    customer_reference: 'DEP-TEST-1',
    completed_at: '2026-10-11T10:00:10.000Z',
  },
};
