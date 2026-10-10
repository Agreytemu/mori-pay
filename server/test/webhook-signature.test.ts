import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import type { AppConfigService } from '../src/config/app-config.service.js';
import { WebhookSignatureService } from '../src/stakaba/webhook-signature.service.js';

function configWith(secret?: string): AppConfigService {
  return { stakaba: { webhookSecret: secret } } as unknown as AppConfigService;
}

describe('WebhookSignatureService', () => {
  const body = Buffer.from(JSON.stringify({ event: 'transaction.success' }));

  it('skips verification when no secret is configured', () => {
    const service = new WebhookSignatureService(configWith(undefined));
    assert.equal(service.verify(undefined, undefined), true);
  });

  it('accepts a correct hex signature', () => {
    const service = new WebhookSignatureService(configWith('shh'));
    const signature = createHmac('sha256', 'shh').update(body).digest('hex');
    assert.equal(service.verify(body, signature), true);
  });

  it('rejects a tampered signature or body', () => {
    const service = new WebhookSignatureService(configWith('shh'));
    assert.equal(service.verify(body, 'deadbeef'), false);
    assert.equal(service.verify(body, undefined), false);
    assert.equal(service.verify(Buffer.from('{}'), undefined), false);
  });
});
