import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pushDeviceRegistrationSchema } from '@mori-pay/contracts';

describe('push device registration contract', () => {
  const validRegistration = {
    name: 'Mori Pay Android',
    platform: 'android' as const,
    clientApp: 'mobile' as const,
    installationId: 'installation-1234567890',
    token: 'fcm-device-token',
  };

  it('accepts a native mobile installation', () => {
    assert.equal(
      pushDeviceRegistrationSchema.safeParse(validRegistration).success,
      true,
    );
  });

  it('requires the declared platform to match the client application', () => {
    assert.equal(
      pushDeviceRegistrationSchema.safeParse({
        ...validRegistration,
        platform: 'web',
      }).success,
      false,
    );
  });

  it('rejects user-supplied ownership identifiers', () => {
    assert.equal(
      pushDeviceRegistrationSchema.safeParse({
        ...validRegistration,
        userId: 'another-user',
      }).success,
      false,
    );
  });
});
