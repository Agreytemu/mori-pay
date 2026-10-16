import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  maskPhoneNumber,
  scrubUrl,
  serializeRequest,
} from '../src/common/redact.js';
import { WithdrawalsService } from '../src/withdrawals/withdrawals.service.js';

const RECIPIENT = '+255712345678';

describe('sensitive logging redaction', () => {
  it('blanks phone query values before a URL is logged', () => {
    const scrubbed = scrubUrl(`/withdrawals/lookup?phone=${RECIPIENT}&limit=5`);
    assert.ok(!scrubbed.includes(RECIPIENT));
    assert.ok(scrubbed.startsWith('/withdrawals/lookup?'));
    assert.ok(scrubbed.includes('redacted'));
    assert.ok(scrubbed.includes('limit=5'));

    assert.equal(scrubUrl('/wallet'), '/wallet');
    assert.equal(scrubUrl('/wallet?cursor=abc123'), '/wallet?cursor=abc123');
  });

  it('masks a phone number down to its trailing digits', () => {
    const masked = maskPhoneNumber(RECIPIENT);
    assert.equal(masked.slice(-3), '678');
    assert.ok(!masked.includes('25571234'));
    assert.equal(maskPhoneNumber('123'), '[redacted]');
    assert.equal(maskPhoneNumber(''), '[redacted]');
  });

  it('never writes a full recipient phone number to lookup logs', async () => {
    const messages: string[] = [];
    const service = new WithdrawalsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        lookupPhone: async () => {
          throw new Error('provider unavailable');
        },
      } as never,
      {} as never,
      {} as never,
    );
    (service as unknown as { logger: { warn: (message: string) => void } })
      .logger = {
      warn: (message: string) => messages.push(message),
    };

    const result = await service.lookupRecipient(RECIPIENT);

    assert.equal(result.found, false);
    assert.equal(result.phoneNumber, RECIPIENT);
    assert.equal(messages.length, 1);
    assert.ok(!messages[0].includes(RECIPIENT));
    assert.ok(messages[0].includes('678'));
    assert.ok(messages[0].includes('provider unavailable'));
  });

  it('scrubs PII from serialized request logs', () => {
    const serialized = serializeRequest({
      id: 'req-1',
      method: 'GET',
      url: `/withdrawals/lookup?phone=${RECIPIENT}`,
      query: { phone: RECIPIENT, limit: '5' },
      params: {},
      headers: { 'user-agent': 'test' },
      remoteAddress: '127.0.0.1',
      remotePort: 4321,
    });

    const json = JSON.stringify(serialized);
    assert.ok(!json.includes(RECIPIENT));
    assert.ok(json.includes('127.0.0.1'));
    assert.equal(typeof serialized.url, 'string');
    assert.ok(String(serialized.url).includes('redacted'));
    assert.ok(JSON.stringify(serialized.query).includes('redacted'));
    assert.ok(JSON.stringify(serialized.query).includes('5'));
    assert.equal(
      JSON.stringify(serialized.headers),
      JSON.stringify({ 'user-agent': 'test' }),
    );
    assert.deepEqual(serializeRequest(null), {});
  });
});
