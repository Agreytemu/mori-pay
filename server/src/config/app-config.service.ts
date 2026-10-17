import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { TierLimits } from '../limits/limits.config.js';
import type { Env } from './env.validation.js';

/** Typed, single source of truth for reading configuration throughout the app. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv() {
    return this.get('NODE_ENV');
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  get isDevelopment() {
    return this.nodeEnv === 'development';
  }

  get port() {
    return this.get('PORT');
  }

  get appName() {
    return this.get('APP_NAME');
  }

  get databaseUrl() {
    return this.get('DATABASE_URL');
  }

  get redisUrl() {
    return this.get('REDIS_URL');
  }

  get fcm() {
    const privateKey = this.get('FIREBASE_PRIVATE_KEY');
    return {
      enabled: this.get('FCM_ENABLED'),
      projectId: this.get('FIREBASE_PROJECT_ID'),
      clientEmail: this.get('FIREBASE_CLIENT_EMAIL'),
      privateKey: privateKey?.replace(/\\n/g, '\n'),
      adminWebUrl: this.get('ADMIN_WEB_URL'),
      merchantWebUrl: this.get('MERCHANT_WEB_URL'),
    };
  }

  get corsOrigins(): string[] {
    const raw = this.get('CORS_ORIGINS');
    if (raw === '*') return ['*'];
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get jwt() {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
    };
  }

  get receiveQrSecret() {
    return this.get('RECEIVE_QR_SECRET');
  }

  get paymentMethodEncryptionKey() {
    return this.get('PAYMENT_METHOD_ENCRYPTION_KEY');
  }

  get otp() {
    return {
      ttlSeconds: this.get('OTP_TTL_SECONDS'),
      maxAttempts: this.get('OTP_MAX_ATTEMPTS'),
    };
  }

  get abliner() {
    return {
      baseUrl: this.get('ABLINER_BASE_URL'),
      apiKey: this.get('ABLINER_API_KEY'),
      webhookSecret: this.get('ABLINER_WEBHOOK_SECRET'),
      callbackUrl: this.get('ABLINER_CALLBACK_URL'),
      smsSenderId: this.get('ABLINER_SMS_SENDER_ID'),
    };
  }

  get reconciliation() {
    return {
      enabled: this.get('RECONCILIATION_ENABLED'),
      intervalSeconds: this.get('RECONCILIATION_INTERVAL_SECONDS'),
      staleSeconds: this.get('RECONCILIATION_STALE_SECONDS'),
    };
  }

  get limits(): { standard: TierLimits; verified: TierLimits } {
    return {
      standard: {
        dailyOutflow: BigInt(this.get('LIMIT_STANDARD_DAILY')),
        perTransaction: BigInt(this.get('LIMIT_STANDARD_PER_TX')),
      },
      verified: {
        dailyOutflow: BigInt(this.get('LIMIT_VERIFIED_DAILY')),
        perTransaction: BigInt(this.get('LIMIT_VERIFIED_PER_TX')),
      },
    };
  }

  get sms() {
    return {
      provider: this.get('SMS_PROVIDER'),
      apiKey: this.get('SMS_API_KEY'),
    };
  }

  get email() {
    return {
      apiKey: this.get('RESEND_API_KEY'),
      from: this.get('EMAIL_FROM'),
      smtp: {
        host: this.get('SMTP_HOST'),
        port: this.get('SMTP_PORT') ?? 465,
        secure: this.get('SMTP_SECURE') ?? (this.get('SMTP_PORT') ?? 465) === 465,
        user: this.get('SMTP_USER'),
        pass: this.get('SMTP_PASS'),
      },
    };
  }

  get logLevel() {
    return this.get('LOG_LEVEL');
  }

  get sentryDsn() {
    return this.get('SENTRY_DSN');
  }
}
