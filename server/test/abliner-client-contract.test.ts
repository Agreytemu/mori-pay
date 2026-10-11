import 'reflect-metadata';

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';

import { AblinerClient, AblinerProviderError } from '../src/abliner/abliner.client.js';
import { ProviderError } from '../src/common/errors.js';
import type { AppConfigService } from '../src/config/app-config.service.js';

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
  it('signs and shapes a deposit exactly as the docs require', async () => {
    const client = new AblinerClient(config({ webhookSecret: 'whsec_test' }));
    stubFetch({
      status: 'success',
      data: {
        id: 'abl_tx_1',
        type: 'deposit',
        flow: 'push',
        status: 'pending',
        amount: 5_000,
        currency: 'TZS',
        method: 'mobile',
        payment_url: null,
        reference: 'ABLREF1',
      },
    });

    const result = await client.createDeposit(depositRequest);
    assert.equal(result.id, 'abl_tx_1');

    const call = lastCapture();
    assert.equal(call.url, 'https://abliner.net/api/v1/deposits');
    assert.equal(call.init.method, 'POST');

    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer tsl_test_key');
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['idempotency-key'], 'idem-1');

    const timestamp = headers['x-abliner-timestamp'];
    assert.ok(timestamp && /^\d+$/.test(timestamp), 'timestamp header present');

    const body = call.init.body as string;
    const expectedSignature = createHmac('sha256', 'whsec_test')
      .update(`${timestamp}.${body}`)
      .digest('hex');
    assert.equal(headers['x-abliner-signature'], expectedSignature);

    assert.deepEqual(JSON.parse(body), {
      amount: 5_000,
      method: 'mobile',
      currency: 'TZS',
      phone: '255700000001',
      reference: 'DEP-TEST-1',
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

  it('looks transactions up by our supported identifiers', async () => {
    const client = new AblinerClient(config());

    stubFetch({ status: 'success', data: [] });
    const missing = await client.findTransaction({ customerReference: 'DEP-1' });
    assert.equal(missing, null);
    assert.ok(lastCapture().url.includes('customer_reference=DEP-1'));

    stubFetch({
      status: 'success',
      data: [{ id: 'abl_tx_9', type: 'deposit', amount: 500, currency: 'TZS', status: 'completed', reference: 'ABL9', created_at: 'now' }],
    });
    const found = await client.findTransaction({ idempotencyKey: 'idem-9' });
    assert.equal(found?.id, 'abl_tx_9');
    assert.ok(lastCapture().url.includes('idempotency_key=idem-9'));
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
        assert.match(error.message, /could not be completed/i);
        return true;
      },
    );
  });
});
