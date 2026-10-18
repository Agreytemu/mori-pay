import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import type { AppConfigService } from '../src/config/app-config.service.js';
import { ClickPesaWebhookSignatureService } from '../src/clickpesa/webhook-signature.service.js';

function config(checksumKey?: string, isProduction = false): AppConfigService {
  return {
    clickpesa: { checksumKey },
    isProduction,
  } as unknown as AppConfigService;
}

function signedPayload(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const unsigned = canonicalize(
    Object.fromEntries(
      Object.entries(payload).filter(
        ([name]) => name !== 'checksum' && name !== 'checksumMethod',
      ),
    ),
  );
  return {
    ...payload,
    checksum: createHmac('sha256', key)
      .update(JSON.stringify(unsigned))
      .digest('hex'),
    checksumMethod: 'HMAC-SHA256',
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

describe('ClickPesaWebhookSignatureService', () => {
  const event = {
    event: 'PAYMENT RECEIVED',
    data: { orderReference: 'DEPABC123', status: 'SUCCESS' },
  };

  it('verifies the canonical HMAC-SHA256 checksum independent of object key order', () => {
    const service = new ClickPesaWebhookSignatureService(config('checksum-key'));
    const signed = signedPayload(event, 'checksum-key');
    assert.equal(service.verify(signed), true);
    assert.equal(
      service.verify({
        checksumMethod: signed.checksumMethod,
        checksum: signed.checksum,
        data: event.data,
        event: event.event,
      }),
      true,
    );
  });

  it('rejects missing, modified, or unsupported checksums', () => {
    const service = new ClickPesaWebhookSignatureService(config('checksum-key'));
    const signed = signedPayload(event, 'checksum-key');
    assert.equal(service.verify(event), false);
    assert.equal(
      service.verify({
        ...signed,
        data: { orderReference: 'OTHER', status: 'SUCCESS' },
      }),
      false,
    );
    assert.equal(
      service.verify({ ...signed, checksumMethod: 'MD5' }),
      false,
    );
  });

  it('allows missing checksums only outside production when not configured', () => {
    assert.equal(
      new ClickPesaWebhookSignatureService(config()).verify(event),
      true,
    );
    assert.equal(
      new ClickPesaWebhookSignatureService(config(undefined, true)).verify(event),
      false,
    );
  });
});
