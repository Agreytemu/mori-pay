import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateEnv } from '../src/config/env.validation.js';

const productionConfig = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/mori_pay',
  JWT_ACCESS_SECRET: 'access-secret-that-is-long-enough',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-long-enough',
  ABLINER_API_KEY: 'tsl_live_test',
  ABLINER_WEBHOOK_SECRET: 'whsec_test',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'payments@example.com',
};

describe('environment validation', () => {
  it('accepts the configured public Abliner callback URL in production', () => {
    const env = validateEnv({
      ...productionConfig,
      ABLINER_WEBHOOK_SECRET: '  whsec_test  ',
      ABLINER_CALLBACK_URL:
        'https://mori-pay.onrender.com/api/v1/webhooks/abliner',
    });

    assert.equal(env.ABLINER_WEBHOOK_SECRET, 'whsec_test');
    assert.equal(
      env.ABLINER_CALLBACK_URL,
      'https://mori-pay.onrender.com/api/v1/webhooks/abliner',
    );
  });

  it('rejects a non-Abliner secret configured for deposit signing', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          ABLINER_WEBHOOK_SECRET: 'wrong-secret-type',
        }),
      /ABLINER_WEBHOOK_SECRET \(must be the Abliner whsec_ signing secret\)/,
    );
  });

  it('rejects a local or insecure Abliner callback URL in production', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          ABLINER_CALLBACK_URL:
            'http://localhost:4000/api/v1/webhooks/abliner',
        }),
      /ABLINER_CALLBACK_URL: must be a public HTTPS URL in production/,
    );
  });
});
