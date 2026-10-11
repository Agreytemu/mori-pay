import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { hmacSha256 } from '../src/common/crypto.js';
import { ReceiveCodeService } from '../src/qr/receive-code.service.js';

const SECRET = 'test-receive-secret-0123456789';

function makeService(secret?: string): ReceiveCodeService {
  return new ReceiveCodeService({
    jwt: { accessSecret: SECRET },
    receiveQrSecret: secret,
  } as never);
}

describe('receive code service', () => {
  it('issues a code that verifies back to the user', () => {
    const service = makeService();
    const { code, expiresAt } = service.issue('usr_1');
    assert.equal(service.verify(code), 'usr_1');
    assert.ok(new Date(expiresAt).getTime() > Date.now());
  });

  it('rejects a tampered code', () => {
    const service = makeService();
    const [version, body] = service.issue('usr_1').code.split('.');
    assert.throws(
      () => service.verify(`${version}.${body}.${'0'.repeat(64)}`),
      BadRequestException,
    );
  });

  it('rejects a malformed code', () => {
    const service = makeService();
    assert.throws(() => service.verify('not-a-code'), BadRequestException);
  });

  it('rejects an expired code', () => {
    const service = makeService();
    const body = Buffer.from(JSON.stringify({ u: 'usr_1', e: 1 })).toString('base64url');
    const signature = hmacSha256(`mp1.${body}`, SECRET);
    assert.throws(() => service.verify(`mp1.${body}.${signature}`), BadRequestException);
  });

  it('honours a dedicated secret when configured', () => {
    const service = makeService('env-secret-0123456789-abcdef');
    assert.equal(service.verify(service.issue('usr_2').code), 'usr_2');
  });
});
