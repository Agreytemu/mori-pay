import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';

/** Header carrying the HMAC-SHA256 signature of the raw webhook body. */
export const STAKABA_SIGNATURE_HEADER = 'x-stakaba-signature';

/**
 * Verifies Stakaba webhook signatures. When no secret is configured (local
 * development and tests) verification is skipped so callbacks still process.
 */
@Injectable()
export class WebhookSignatureService {
  constructor(private readonly config: AppConfigService) {}

  verify(rawBody: Buffer | undefined, signature?: string): boolean {
    const secret = this.config.stakaba.webhookSecret;
    if (!secret) return true;
    if (!rawBody || !signature) return false;

    const expected = Buffer.from(
      createHmac('sha256', secret).update(rawBody).digest('hex'),
      'utf8',
    );
    const provided = Buffer.from(signature.trim().toLowerCase(), 'utf8');

    if (provided.length !== expected.length) return false;
    return timingSafeEqual(expected, provided);
  }
}
