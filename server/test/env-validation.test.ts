import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateEnv } from '../src/config/env.validation.js';

const productionConfig = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/mori_pay',
  CORS_ORIGINS: 'https://app.moripay.example',
  JWT_ACCESS_SECRET: 'access-secret-that-is-long-enough',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-long-enough',
  ABLINER_API_KEY: 'tsl_live_test',
  ABLINER_WEBHOOK_SECRET: 'whsec_test',
  PAYMENT_METHOD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'payments@example.com',
};

describe('environment validation', () => {
  it('accepts complete initial super-admin credentials and normalizes the email', () => {
    const env = validateEnv({
      ...productionConfig,
      INITIAL_SUPER_ADMIN_EMAIL: '  ROOT@example.com ',
      INITIAL_SUPER_ADMIN_PASSWORD: 'a-long-bootstrap-password',
      INITIAL_SUPER_ADMIN_NAME: 'Root Admin',
    });

    assert.equal(env.INITIAL_SUPER_ADMIN_EMAIL, 'root@example.com');
    assert.equal(env.INITIAL_SUPER_ADMIN_PASSWORD, 'a-long-bootstrap-password');
    assert.equal(env.INITIAL_SUPER_ADMIN_NAME, 'Root Admin');
  });

  it('rejects incomplete or weak initial super-admin credentials', () => {
    assert.throws(
      () => validateEnv({
        ...productionConfig,
        INITIAL_SUPER_ADMIN_EMAIL: 'root@example.com',
      }),
      /INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD must be configured together/,
    );
    assert.throws(
      () => validateEnv({
        ...productionConfig,
        INITIAL_SUPER_ADMIN_EMAIL: 'root@example.com',
        INITIAL_SUPER_ADMIN_PASSWORD: 'short',
      }),
      /INITIAL_SUPER_ADMIN_PASSWORD: Too small/,
    );
  });

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

  it('defaults the Abliner callback to the Railway API host', () => {
    const env = validateEnv(productionConfig);

    assert.equal(
      env.ABLINER_CALLBACK_URL,
      'https://moripay.up.railway.app/api/v1/webhooks/abliner',
    );
  });

  it('requires complete server and portal configuration when FCM is enabled', () => {
    assert.throws(
      () => validateEnv({ ...productionConfig, FCM_ENABLED: 'true' }),
      /FIREBASE_PROJECT_ID is required when FCM_ENABLED=true/,
    );

    const env = validateEnv({
      ...productionConfig,
      FCM_ENABLED: 'true',
      FIREBASE_PROJECT_ID: 'mori-pay-test',
      FIREBASE_CLIENT_EMAIL: 'fcm@mori-pay-test.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nvalue\\n-----END PRIVATE KEY-----',
      ADMIN_WEB_URL: 'https://admin.mori-pay.example',
      MERCHANT_WEB_URL: 'https://merchant.mori-pay.example',
    });
    assert.equal(env.FCM_ENABLED, true);
    assert.equal(env.FIREBASE_PROJECT_ID, 'mori-pay-test');
  });

  it('rejects insecure production web origins when FCM is enabled', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          FCM_ENABLED: 'true',
          FIREBASE_PROJECT_ID: 'mori-pay-test',
          FIREBASE_CLIENT_EMAIL: 'fcm@mori-pay-test.iam.gserviceaccount.com',
          FIREBASE_PRIVATE_KEY: 'private-key',
          ADMIN_WEB_URL: 'http://admin.mori-pay.example',
          MERCHANT_WEB_URL: 'https://merchant.mori-pay.example',
        }),
      /ADMIN_WEB_URL must use HTTPS/,
    );
  });

  it('rejects development-default JWT secrets in production', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          JWT_ACCESS_SECRET: 'dev-access-secret-change-me-32chars',
          JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me-32chars',
        }),
      /JWT_ACCESS_SECRET: must be explicitly set to a unique secret in production/,
    );
  });

  it('rejects missing JWT secrets in production', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          JWT_ACCESS_SECRET: '',
          JWT_REFRESH_SECRET: '',
        }),
      /JWT_ACCESS_SECRET: must be explicitly set to a unique secret in production/,
    );
  });

  it('rejects short or reused JWT secrets in production', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          JWT_ACCESS_SECRET: 'short-secret',
        }),
      /JWT_ACCESS_SECRET: must be at least 32 characters in production/,
    );

    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          JWT_REFRESH_SECRET: productionConfig.JWT_ACCESS_SECRET,
        }),
      /JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET/,
    );
  });

  it('rejects a wildcard or missing production CORS allowlist', () => {
    assert.throws(
      () => validateEnv({ ...productionConfig, CORS_ORIGINS: '*' }),
      /CORS_ORIGINS: an explicit comma-separated allowlist/,
    );

    assert.throws(
      () => validateEnv({ ...productionConfig, CORS_ORIGINS: '' }),
      /CORS_ORIGINS: an explicit comma-separated allowlist/,
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

  it('rejects a non-live Abliner API key in production', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          ABLINER_API_KEY: 'tsl_test_key',
        }),
      /ABLINER_API_KEY \(must be a production tsl_live_ key\)/,
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

  it('accepts Resend as the production provider with SMTP fallback configured', () => {
    const env = validateEnv({
      ...productionConfig,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'payments@example.com',
      SMTP_PASS: 'google-app-password',
      EMAIL_FROM: 'payments@example.com',
    });

    assert.equal(env.SMTP_PORT, 465);
    assert.equal(env.SMTP_SECURE, true);
  });

  it('requires Resend as the production email provider', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          RESEND_API_KEY: '',
          SMTP_HOST: 'smtp.gmail.com',
          SMTP_USER: 'payments@example.com',
          SMTP_PASS: 'google-app-password',
        }),
      /RESEND_API_KEY and EMAIL_FROM are required in production/,
    );
  });

  it('rejects incomplete SMTP credentials when they are partially configured', () => {
    assert.throws(
      () =>
        validateEnv({
          ...productionConfig,
          RESEND_API_KEY: '',
          SMTP_HOST: 'smtp.gmail.com',
          SMTP_USER: 'payments@example.com',
          SMTP_PASS: '',
        }),
      /SMTP_PASS: required when configuring SMTP/,
    );
  });
});
