import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import type { AppConfigService } from '../src/config/app-config.service.js';
import { AblinerWebhookSignatureService } from '../src/abliner/webhook-signature.service.js';

function configWith(
  secret?: string,
  isProduction = false,
): AppConfigService {
  return {
    abliner: { webhookSecret: secret },
    isProduction,
  } as unknown as AppConfigService;
}

function sign(secret: string, timestamp: string, body: Buffer): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body.toString('utf8')}`)
    .digest('hex');
}

describe('AblinerWebhookSignatureService', () => {
  const body = Buffer.from(JSON.stringify({ id: 'evt_1', event: 'transaction.completed' }));

  it('skips verification when no secret is configured outside production', () => {
    const service = new AblinerWebhookSignatureService(configWith(undefined));
    assert.equal(service.verify(undefined, undefined, undefined), true);
  });

  it('rejects every webhook when no secret is configured in production', () => {
    const service = new AblinerWebhookSignatureService(configWith(undefined, true));
    assert.equal(service.verify(undefined, undefined, undefined), false);
    assert.equal(service.verify(body, 'deadbeef', '123'), false);
  });

  it('accepts a correct signature within the clock skew', () => {
    const service = new AblinerWebhookSignatureService(configWith('whsec_shh'));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    assert.equal(service.verify(body, sign('whsec_shh', timestamp, body), timestamp), true);
  });

  it('rejects a tampered signature or body', () => {
    const service = new AblinerWebhookSignatureService(configWith('whsec_shh'));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    assert.equal(service.verify(body, 'deadbeef', timestamp), false);
    assert.equal(service.verify(body, sign('whsec_shh', timestamp, body), undefined), false);
    assert.equal(
      service.verify(Buffer.from('{}'), sign('whsec_shh', timestamp, body), timestamp),
      false,
    );
  });

  it('rejects a timestamp older than five minutes', () => {
    const service = new AblinerWebhookSignatureService(configWith('whsec_shh'));
    const stale = (Math.floor(Date.now() / 1000) - 3600).toString();
    assert.equal(service.verify(body, sign('whsec_shh', stale, body), stale), false);
  });
});
