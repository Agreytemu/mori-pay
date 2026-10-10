import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  get sms() {
    return {
      provider: this.get('SMS_PROVIDER'),
      apiKey: this.get('SMS_API_KEY'),
    };
  }

  get logLevel() {
    return this.get('LOG_LEVEL');
  }

  get sentryDsn() {
    return this.get('SENTRY_DSN');
  }
}
