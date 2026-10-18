import 'reflect-metadata';

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  ClickPesaClient,
  ClickPesaProviderError,
} from '../src/clickpesa/clickpesa.client.js';
import type { AppConfigService } from '../src/config/app-config.service.js';

type CapturedRequest = {
  url: string;
  init: RequestInit;
};

const originalFetch = globalThis.fetch;
let requests: CapturedRequest[] = [];

function config(): AppConfigService {
  return {
    clickpesa: {
      baseUrl: 'https://api.clickpesa.test/third-parties',
      clientId: 'client-id',
      apiKey: 'api-key',
      checksumKey: 'checksum-key',
    },
  } as unknown as AppConfigService;
}

function stubFetch(
  handler: (url: string, init: RequestInit) => Response,
): void {
  requests = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const request = { url: String(url), init: init ?? {} };
    requests.push(request);
    return handler(request.url, request.init);
  }) as typeof fetch;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ClickPesaClient contract', () => {
  it('generates a token, previews, and starts a USSD push using documented fields', async () => {
    stubFetch((url) => {
      if (url.endsWith('/generate-token')) {
        return jsonResponse({ success: true, token: 'Bearer clickpesa-jwt' });
      }
      if (url.endsWith('/preview-ussd-push-request')) {
        return jsonResponse({
          activeMethods: [{ name: 'M-PESA', status: 'AVAILABLE', fee: 0 }],
        });
      }
      return jsonResponse({
        id: 'payment-1',
        status: 'PROCESSING',
        orderReference: 'DEPABC123',
      });
    });

    const client = new ClickPesaClient(config());
    const request = {
      amount: 10_000,
      currency: 'TZS' as const,
      orderReference: 'DEPABC123',
      phoneNumber: '255700000001',
    };
    const preview = await client.previewUssdPush(request);
    const payment = await client.initiateUssdPush(request);

    assert.equal(preview.activeMethods[0]?.status, 'AVAILABLE');
    assert.equal(payment.orderReference, request.orderReference);
    assert.equal(requests.length, 3);
    assert.deepEqual(
      JSON.parse(String(requests[1]?.init.body)),
      {
        amount: '10000',
        currency: 'TZS',
        orderReference: 'DEPABC123',
        phoneNumber: '255700000001',
      },
    );
    assert.equal(
      (requests[1]?.init.headers as Record<string, string>).authorization,
      'Bearer clickpesa-jwt',
    );
    assert.deepEqual(requests[0]?.init.headers, {
      'client-id': 'client-id',
      'api-key': 'api-key',
    });
  });

  it('queries payment status by encoded order reference and reuses the token', async () => {
    stubFetch((url) => {
      if (url.endsWith('/generate-token')) {
        return jsonResponse({ success: true, token: 'Bearer clickpesa-jwt' });
      }
      return jsonResponse([
        {
          id: 'payment-1',
          status: 'SUCCESS',
          orderReference: 'DEPABC123',
          collectedAmount: 10_000,
          collectedCurrency: 'TZS',
        },
      ]);
    });

    const payment = await new ClickPesaClient(config()).getPayment('DEPABC123');
    assert.equal(payment?.status, 'SUCCESS');
    assert.equal(
      requests[1]?.url,
      'https://api.clickpesa.test/third-parties/payments/DEPABC123',
    );
    assert.equal(requests.length, 2);
  });

  it('treats a payout status 404 as an authoritative missing order', async () => {
    stubFetch((url) =>
      url.endsWith('/generate-token')
        ? jsonResponse({ success: true, token: '******' })
        : jsonResponse({ message: 'Not found' }, 404),
    );

    assert.equal(await new ClickPesaClient(config()).getPayout('WDRABC123'), null);
  });

  it('previews, submits, and queries documented mobile and bank payouts', async () => {
    const payout = (channel: string) => ({
      id: `payout-${channel}`,
      orderReference: 'WDRABC123',
      amount: '10250.00',
      currency: 'TZS',
      fee: '250.00',
      status: 'PROCESSING',
      channel,
      order: { amount: '10000.00', currency: 'TZS' },
      beneficiary: { accountName: 'Jane Doe', accountNumber: '255700000001' },
    });
    stubFetch((url) => {
      if (url.endsWith('/generate-token')) {
        return jsonResponse({ success: true, token: '******' });
      }
      if (url.endsWith('/list/banks')) {
        return jsonResponse([{ name: 'Example Bank', bic: 'EXAMTZTZ' }]);
      }
      if (url.endsWith('/preview-mobile-money-payout')) {
        return jsonResponse({
          fee: '250.00',
          balance: '50000.00',
          receiver: { accountName: 'Jane Doe' },
        });
      }
      if (url.endsWith('/preview-bank-payout')) {
        return jsonResponse({
          fee: '250.00',
          receiver: { accountName: 'Jane Doe' },
        });
      }
      if (url.endsWith('/payouts/WDRABC123')) {
        return jsonResponse([payout('BANK TRANSFER')]);
      }
      if (url.endsWith('/create-bank-payout')) {
        return jsonResponse(payout('BANK TRANSFER'));
      }
      return jsonResponse(payout('MOBILE MONEY'));
    });

    const client = new ClickPesaClient(config());
    const mobileRequest = {
      amount: 10_000,
      currency: 'TZS' as const,
      orderReference: 'WDRABC123',
      phoneNumber: '255700000001',
    };
    const bankRequest = {
      amount: 10_000,
      currency: 'TZS' as const,
      orderReference: 'WDRABC123',
      accountNumber: '012345678901',
      accountName: 'Jane Doe',
      bic: 'EXAMTZTZ',
      accountCurrency: 'TZS' as const,
    };
    const bankPreviewRequest = {
      amount: bankRequest.amount,
      currency: bankRequest.currency,
      orderReference: bankRequest.orderReference,
      accountNumber: bankRequest.accountNumber,
      bic: bankRequest.bic,
      accountCurrency: bankRequest.accountCurrency,
    };
    const banks = await client.listBanks();
    const mobilePreview = await client.previewMobileMoneyPayout(mobileRequest);
    const bankPreview = await client.previewBankPayout(bankPreviewRequest);
    const mobilePayout = await client.createMobileMoneyPayout(mobileRequest);
    const bankPayout = await client.createBankPayout(bankRequest);
    const queried = await client.getPayout('WDRABC123');

    assert.deepEqual(banks, [{ name: 'Example Bank', bic: 'EXAMTZTZ' }]);
    assert.equal(mobilePreview.recipientName, 'Jane Doe');
    assert.equal(bankPreview.recipientName, 'Jane Doe');
    assert.equal(mobilePayout.channel, 'MOBILE MONEY');
    assert.equal(bankPayout.amount, '10000.00');
    assert.equal(queried?.channel, 'BANK TRANSFER');
    assert.equal(
      requests.find((item) => item.url.endsWith('/preview-bank-payout'))?.init.body,
      JSON.stringify({
        amount: 10_000,
        currency: 'TZS',
        orderReference: 'WDRABC123',
        accountNumber: '012345678901',
        bic: 'EXAMTZTZ',
        accountCurrency: 'TZS',
      }),
    );
    assert.equal(
      requests.find((item) => item.url.endsWith('/create-bank-payout'))?.init.body,
      JSON.stringify({
        amount: 10_000,
        currency: 'TZS',
        orderReference: 'WDRABC123',
        accountNumber: '012345678901',
        accountName: 'Jane Doe',
        bic: 'EXAMTZTZ',
        accountCurrency: 'TZS',
      }),
    );
  });

  it('does not expose provider response details in errors', async () => {
    stubFetch((url) =>
      url.endsWith('/generate-token')
        ? jsonResponse({ success: true, token: 'Bearer clickpesa-jwt' })
        : jsonResponse({ message: 'sensitive provider details' }, 500),
    );

    await assert.rejects(
      new ClickPesaClient(config()).getPayment('DEPABC123'),
      (error: unknown) => {
        assert.ok(error instanceof ClickPesaProviderError);
        assert.equal(error.retryable, true);
        assert.equal(error.message.includes('sensitive'), false);
        return true;
      },
    );
  });

  it('marks malformed successful payout creates as uncertain, not failed', async () => {
    stubFetch((url) => {
      if (url.endsWith('/generate-token')) {
        return jsonResponse({ success: true, token: '******' });
      }
      return jsonResponse({ success: true });
    });

    await assert.rejects(
      new ClickPesaClient(config()).createMobileMoneyPayout({
        amount: 5_000,
        currency: 'TZS',
        orderReference: 'WDRABC123',
        phoneNumber: '255700000001',
      }),
      (error: unknown) => {
        assert.ok(error instanceof ClickPesaProviderError);
        assert.equal(error.retryable, true);
        return true;
      },
    );
  });
});
