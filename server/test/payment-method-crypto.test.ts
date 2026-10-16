import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decryptPaymentMethodPhone,
  encryptPaymentMethodPhone,
} from '../src/common/payment-method-crypto.js';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');

describe('saved payment method phone encryption', () => {
  it('encrypts and decrypts a phone number', () => {
    const encrypted = encryptPaymentMethodPhone('255712345678', encryptionKey);

    assert.notEqual(encrypted, '255712345678');
    assert.equal(decryptPaymentMethodPhone(encrypted, encryptionKey), '255712345678');
  });

  it('rejects tampered ciphertext and a different encryption key', () => {
    const encrypted = encryptPaymentMethodPhone('255712345678', encryptionKey);
    const parts = encrypted.split(':');
    parts[2] = Buffer.alloc(16).toString('base64');

    assert.throws(() => decryptPaymentMethodPhone(parts.join(':'), encryptionKey));
    assert.throws(() =>
      decryptPaymentMethodPhone(
        encrypted,
        Buffer.alloc(32, 8).toString('base64'),
      ),
    );
  });
});
