import 'reflect-metadata';

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';

import {
  AblinerClient,
  AblinerProviderError,
} from '../src/abliner/abliner.client.js';
import { ProviderError } from '../src/common/errors.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import {
  ablinerWebhookSchema,
  topupCardPreviewQuerySchema,
  topupCardSchema,
  topupMobileMoneySchema,
} from '@mori-pay/contracts';
import {
  completedTransactionFixture,
  completedWebhookFixture,
  depositRequestBodyFixture,
  pendingDepositResponseFixture,
} from './fixtures/abliner-contract.fixtures.js';

type Captured = { url: string; init: RequestInit };

function config(overrides: {
  apiKey?: string;
  webhookSecret?: string;
  baseUrl?: string;
} = {}): AppConfigService {
  return {
    abliner: {
      baseUrl: overrides.baseUrl ?? 'https://abliner.net',
      apiKey: overrides.apiKey ?? 'tsl_test_key',
      webhookSecret: overrides.webhookSecret,
      callbackUrl: 'https://pay.example.com/api/v1/webhooks/abliner',
      smsSenderId: undefined,
    },
  } as unknown as AppConfigService;
}

const originalFetch = globalThis.fetch;
let captured: Captured | undefined;

function stubFetch(payload: unknown, status = 200): void {
  captured = undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

function lastCapture(): Captured {
  assert.ok(captured, 'fetch should have been called');
  return captured;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const depositRequest = {
  amount: 5_000,
  method: 'mobile' as const,
  currency: 'TZS' as const,
  phone: '255700000001',
  reference: 'DEP-TEST-1',
  callbackUrl: 'https://pay.example.com/api/v1/webhooks/abliner',
  idempotencyKey: 'idem-1',
};

describe('AblinerClient contract', () => {
  it('enforces Abliner deposit amount bounds at top-up and preview inputs', () => {
    const mobileTopup = {
      amount: 3_000_000,
      mobileNumber: '255700000001',
    };
    assert.equal(topupMobileMoneySchema.safeParse(mobileTopup).success, true);
    assert.equal(
      topupMobileMoneySchema.safeParse({
        ...mobileTopup,
        amount: 3_000_001,
      }).success,
      false,
    );
    assert.equal(
      topupCardSchema.safeParse({ amount: 3_000_001 }).success,
      false,
    );
    assert.equal(
      topupCardPreviewQuerySchema.safeParse({ amount: '3000001' }).success,
      false,
    );
    assert.equal(
      topupCardPreviewQuerySchema.safeParse({ amount: '3000000' }).success,
      true,
    );
  });

  it('signs and shapes a deposit exactly as the docs require', async () => {
    const client = new AblinerClient(config({ webhookSecret: 'whsec_test' }));
    stubFetch(pendingDepositResponseFixture);

    const before = Math.floor(Date.now() / 1000);
    const result = await client.createDeposit(depositRequest);
    const after = Math.floor(Date.now() / 1000);
    assert.equal(result.id, 'abl_tx_1');

    const call = lastCapture();
    assert.equal(call.url, 'https://abliner.net/api/v1/deposits');
    assert.equal(call.init.method, 'POST');

    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer tsl_test_key');
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['idempotency-key'], 'idem-1');

    const timestamp = headers['x-abliner-timestamp'];
    assert.match(timestamp, /^\d{10}$/, 'timestamp is Unix seconds');
    assert.ok(Number(timestamp) >= before && Number(timestamp) <= after);

    const bodyBytes = Buffer.from(call.init.body as Uint8Array);
    const body = bodyBytes.toString('utf8');
    assert.deepEqual(
      bodyBytes,
      Buffer.from(JSON.stringify(depositRequestBodyFixture), 'utf8'),
      'the exact serialized bytes are sent',
    );
    const expectedSignature = createHmac('sha256', 'whsec_test')
      .update(
        Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), bodyBytes]),
      )
      .digest('hex');
    assert.equal(headers['x-abliner-signature'], expectedSignature);
    assert.match(headers['x-abliner-signature'], /^[a-f0-9]{64}$/);

    assert.deepEqual(JSON.parse(body), depositRequestBodyFixture);
  });

  it('sends the configured callback URL with withdrawal requests', async () => {
    const client = new AblinerClient(config());
    stubFetch({
      status: 'success',
      data: {
        id: 'abl_withdrawal_1',
        status: 'processing',
        amount: 5_000,
        currency: 'TZS',
      },
    });

    await client.createWithdrawal({
      amount: 5_000,
      method: 'mobile',
      currency: 'TZS',
      recipient: '255700000001',
      reference: 'WDR-TEST-1',
    });

    const call = lastCapture();
    assert.equal(call.url, 'https://abliner.net/api/v1/withdrawals');
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(JSON.parse(Buffer.from(call.init.body as Uint8Array).toString('utf8')), {
      amount: 5_000,
      method: 'mobile',
      currency: 'TZS',
      recipient: '255700000001',
      reference: 'WDR-TEST-1',
      callback_url: 'https://pay.example.com/api/v1/webhooks/abliner',
    });
  });

  it('refuses to sign a deposit without a webhook secret', async () => {
    const client = new AblinerClient(config({ webhookSecret: undefined }));
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => client.createDeposit(depositRequest),
      (error: unknown) => error instanceof ProviderError,
    );
    assert.equal(called, false, 'no network call should be attempted');
  });

  it('refuses a secret that is not an Abliner webhook signing secret', async () => {
    const client = new AblinerClient(config({ webhookSecret: 'not-a-whsec' }));
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => client.createDeposit(depositRequest),
      (error: unknown) => error instanceof ProviderError,
    );
    assert.equal(called, false, 'misconfigured secret must not reach Abliner');
  });

  it('looks transactions up by our supported identifiers', async () => {
    const client = new AblinerClient(config());

    stubFetch({
      status: 'success',
      data: [
        {
          ...completedTransactionFixture,
          id: 'other_transaction',
          customer_reference: 'OTHER-REFERENCE',
        },
        completedTransactionFixture,
      ],
    });
    const byId = await client.findTransaction({ id: 'abl_tx_1' });
    assert.equal(byId?.id, 'abl_tx_1');
    assert.ok(lastCapture().url.includes('id=abl_tx_1'));
    assert.ok(lastCapture().url.includes('limit=50'));

    stubFetch({
      status: 'success',
      data: [
        {
          ...completedTransactionFixture,
          id: 'other_transaction',
          status: 'failed',
          customer_reference: 'OTHER-REFERENCE',
        },
      ],
    });
    const missing = await client.findTransaction({ customerReference: 'DEP-1' });
    assert.equal(missing, null);
    assert.ok(lastCapture().url.includes('customer_reference=DEP-1'));

    stubFetch({
      status: 'success',
      data: [
        {
          ...completedTransactionFixture,
          idempotency_key: 'idem-9',
        },
      ],
    });
    const found = await client.findTransaction({ idempotencyKey: 'idem-9' });
    assert.equal(found?.id, completedTransactionFixture.id);
    assert.ok(lastCapture().url.includes('idempotency_key=idem-9'));
  });

  it('does not treat an unrelated failed provider transaction as a match', async () => {
    const client = new AblinerClient(config());
    stubFetch({
      status: 'success',
      data: [
        {
          ...completedTransactionFixture,
          id: 'unrelated-failed-transaction',
          status: 'failed',
          customer_reference: 'SOMEONE-ELSE',
        },
      ],
    });

    const result = await client.findTransaction({ id: 'our-provider-transaction' });

    assert.equal(result, null);
  });

  it('accepts the documented webhook fixture shape', () => {
    assert.deepEqual(
      ablinerWebhookSchema.parse(completedWebhookFixture),
      completedWebhookFixture,
    );
  });

  it('maps a known provider code to a safe user message', async () => {
    const client = new AblinerClient(config({ webhookSecret: 'whsec_test' }));
    stubFetch(
      { status: 'error', code: 'insufficient_funds', message: 'wallet balance is too low', retryable: false },
      402,
    );

    await assert.rejects(
      () => client.createDeposit(depositRequest),
      (error: unknown) => {
        assert.ok(error instanceof AblinerProviderError);
        assert.equal(error.providerCode, 'insufficient_funds');
        assert.match(error.message, /enough funds/i);
        assert.equal(error.detail, 'wallet balance is too low');
        return true;
      },
    );
  });

  it('never leaks an unknown provider message to the client', async () => {
    const client = new AblinerClient(config({ webhookSecret: 'whsec_test' }));
    const logs: string[] = [];
    Object.defineProperty(client, 'logger', {
      value: { error: (message: string) => logs.push(message) },
    });
    stubFetch(
      { status: 'error', code: 'invalid_request_signature', message: 'signature mismatch for key tsl_live_abc', retryable: false },
      401,
    );

    await assert.rejects(
      () => client.createDeposit(depositRequest),
      (error: unknown) => {
        assert.ok(error instanceof AblinerProviderError);
        assert.equal(error.providerCode, 'invalid_request_signature');
        assert.doesNotMatch(error.message, /tsl_live/);
        assert.equal(
          error.message,
          'The payment service is temporarily unavailable.',
        );
        assert.equal(logs.length, 1);
        const diagnostic = JSON.parse(logs[0]) as {
          status: number;
          code: string;
          message: string;
        };
        assert.equal(diagnostic.status, 401);
        assert.equal(diagnostic.code, 'invalid_request_signature');
        assert.match(diagnostic.message, /\[redacted\]/);
        assert.doesNotMatch(logs.join('\n'), /signature mismatch|tsl_live_abc/i);
        return true;
      },
    );
  });

  it('logs redacted structured diagnostics for HTTP 422 validation failures', async () => {
    const client = new AblinerClient(config({ webhookSecret: 'whsec_test' }));
    const logs: string[] = [];
    Object.defineProperty(client, 'logger', {
      value: { error: (message: string) => logs.push(message) },
    });
    stubFetch(
      {
        status: 'error',
        code: 'validation_failed',
        message:
          "Invalid phone 255712345678 belongs to Jane Doe; email jane@example.com; key tsl_live_private",
        field: 'phone',
        errors: [
          {
            field: 'phone',
            message: 'Phone 255712345678 belongs to Jane Doe',
          },
          { field: 'callback_url', message: 'callback_url must use HTTPS' },
          { field: 'mobileNumber', message: 'must not be logged' },
        ],
      },
      422,
    );

    await assert.rejects(
      () => client.createDeposit(depositRequest),
      (error: unknown) => {
        assert.ok(error instanceof AblinerProviderError);
        assert.equal(error.providerCode, 'validation_failed');
        assert.equal(
          error.message,
          'The payment details were rejected. Review them and try again.',
        );
        assert.doesNotMatch(
          `${error.detail}\n${error.message}`,
          /255712345678|Jane Doe|jane@example.com|tsl_live_private/,
        );
        return true;
      },
    );

    assert.equal(logs.length, 1);
    const diagnostic = JSON.parse(logs[0]) as {
      provider: string;
      method: string;
      path: string;
      status: number;
      code: string;
      field: string;
      message: string;
      validationErrors: Array<{ field: string; message?: string }>;
    };
    assert.deepEqual(
      {
        provider: diagnostic.provider,
        method: diagnostic.method,
        path: diagnostic.path,
        status: diagnostic.status,
        code: diagnostic.code,
        field: diagnostic.field,
      },
      {
        provider: 'abliner',
        method: 'POST',
        path: '/api/v1/deposits',
        status: 422,
        code: 'validation_failed',
        field: 'phone',
      },
    );
    assert.doesNotMatch(
      diagnostic.message,
      /255712345678|Jane Doe|jane@example.com|tsl_live_private/,
    );
    assert.match(diagnostic.message, /\[redacted\]/);
    assert.deepEqual(
      diagnostic.validationErrors.map(({ field }) => field),
      ['phone', 'callback_url'],
    );
    assert.doesNotMatch(
      JSON.stringify(diagnostic),
      /255712345678|Jane Doe|jane@example.com|tsl_live_private/,
    );
  });

  it('maps provider error codes to safe messages across HTTP error statuses', async () => {
    const cases = [
      {
        status: 400,
        code: 'validation_failed',
        message: 'The payment details were rejected. Review them and try again.',
      },
      {
        status: 401,
        code: 'invalid_request_signature',
        message: 'The payment service is temporarily unavailable.',
      },
      {
        status: 402,
        code: 'insufficient_funds',
        message: 'You do not have enough funds for this transaction.',
      },
      {
        status: 422,
        code: 'amount_out_of_range',
        message: 'That amount is outside the allowed range.',
      },
      {
        status: 422,
        code: 'unsupported_request',
        message: 'This payment method is not available right now.',
      },
      {
        status: 502,
        code: 'provider_error',
        message: 'The payment provider could not complete this request. Please try again.',
      },
    ];

    for (const { status, code, message } of cases) {
      const client = new AblinerClient(config({ webhookSecret: 'whsec_test' }));
      stubFetch(
        {
          status: 'error',
          code,
          message: 'raw provider detail containing sensitive data',
          retryable: status >= 500,
        },
        status,
      );

      await assert.rejects(
        () => client.createDeposit(depositRequest),
        (error: unknown) => {
          assert.ok(error instanceof AblinerProviderError);
          assert.equal(error.providerCode, code);
          assert.equal(error.message, message);
          assert.doesNotMatch(error.message, /raw provider detail|sensitive data/i);
          return true;
        },
      );
    }
  });
});
