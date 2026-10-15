import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  installBigIntJsonSerialization,
  serializeBigInt,
} from '../src/common/bigint-json.js';

describe('bigint JSON serialisation', () => {
  it('keeps safe amounts as numbers to preserve the API contract', () => {
    assert.equal(serializeBigInt(0n), 0);
    assert.equal(serializeBigInt(10_000n), 10_000);
    assert.equal(
      serializeBigInt(BigInt(Number.MAX_SAFE_INTEGER)),
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('serialises unsafe amounts as decimal strings instead of corrupting them', () => {
    const unsafe = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    assert.equal(serializeBigInt(unsafe), unsafe.toString());
    assert.equal(typeof serializeBigInt(unsafe), 'string');
  });

  it('does not silently lose precision when JSON.stringify is used', () => {
    installBigIntJsonSerialization();
    const unsafe = BigInt(Number.MAX_SAFE_INTEGER) * 3n;
    const encoded = JSON.stringify({ amount: unsafe });
    assert.equal(encoded, `{"amount":"${unsafe.toString()}"}`);
    assert.equal(JSON.parse(encoded).amount, unsafe.toString());
  });
});
