import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateNumericCode,
  hashPin,
  safeEqualHex,
  sha256,
  verifyPinHash,
} from '../src/common/crypto.js';

describe('crypto', () => {
  it('generates numeric codes of the requested length', () => {
    for (const length of [4, 6, 10]) {
      const code = generateNumericCode(length);
      assert.equal(code.length, length);
      assert.match(code, /^\d+$/);
    }
  });

  it('hashes and verifies PINs', async () => {
    const hash = await hashPin('123456');
    assert.match(hash, /^scrypt:[0-9a-f]+:[0-9a-f]+$/);
    assert.equal(await verifyPinHash('123456', hash), true);
    assert.equal(await verifyPinHash('654321', hash), false);
    assert.equal(await verifyPinHash('123456', null), false);
  });

  it('compares hex digests in constant time', () => {
    assert.equal(safeEqualHex(sha256('same'), sha256('same')), true);
    assert.equal(safeEqualHex(sha256('a'), sha256('b')), false);
    assert.equal(safeEqualHex('', sha256('a')), false);
  });
});
