import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deviceInfoSchema,
  emailRegisterSchema,
  emailSignInSchema,
  pinSignInSchema,
} from '@mori-pay/contracts';

describe('email auth contracts', () => {
  it('normalizes email and accepts signup without a phone number', () => {
    const result = emailRegisterSchema.safeParse({
      fullName: 'Amina Juma',
      firstName: 'Amina',
      email: 'AMINA@example.com ',
      password: 'strong-password-123',
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.email, 'amina@example.com');
      assert.equal('phone' in result.data, false);
    }
  });

  it('rejects short passwords and malformed email addresses', () => {
    assert.equal(
      emailRegisterSchema.safeParse({
        fullName: 'Amina Juma',
        firstName: 'Amina',
        email: 'not-an-email',
        password: 'short',
      }).success,
      false,
    );
  });

  it('requires a six-digit PIN for PIN sign-in', () => {
    assert.equal(
      pinSignInSchema.safeParse({
        email: 'amina@example.com',
        pin: '12345',
      }).success,
      false,
    );
    assert.equal(
      pinSignInSchema.safeParse({
        email: 'amina@example.com',
        pin: '123456',
      }).success,
      true,
    );
  });

  it('allows password sign-in with a valid email and non-empty password', () => {
    assert.equal(
      emailSignInSchema.safeParse({
        email: 'AMINA@example.com',
        password: 'password',
      }).success,
      true,
    );
  });

  it('accepts an optional stable installation ID for trusted-device reuse', () => {
    const device = {
      name: 'Mori Pay app',
      platform: 'android',
      installationId: 'a'.repeat(48),
    };
    assert.equal(deviceInfoSchema.safeParse(device).success, true);
    assert.equal(
      deviceInfoSchema.safeParse({ ...device, installationId: 'short' }).success,
      false,
    );
    assert.equal(
      deviceInfoSchema.safeParse({ name: 'Mori Pay app', platform: 'ios' }).success,
      true,
    );
  });
});
