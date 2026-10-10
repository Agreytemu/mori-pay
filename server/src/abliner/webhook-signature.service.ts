import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';

/** Hex HMAC-SHA256 of `${timestamp}.${rawBody}`. */
export const ABLINER_SIGNATURE_HEADER = 'x-webhook-signature';
/** Unix timestamp (seconds) included in the signature. */
export const ABLINER_TIMESTAMP_HEADER = 'x-webhook-timestamp';
/** Stable per-event id, used to de-duplicate retries. */
export const ABLINER_EVENT_ID_HEADER = 'x-webhook-id';

/** Reject callbacks signed with a timestamp older than this many seconds. */
const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * Verifies Abliner webhook signatures. When no secret is configured (local
 * development and tests) verification is skipped so callbacks still process.
 */
@Injectable()
export class AblinerWebhookSignatureService {
  constructor(private readonly config: AppConfigService) {}

  verify(
    rawBody: Buffer | undefined,
    signature?: string,
    timestamp?: string,
  ): boolean {
    const secret = this.config.abliner.webhookSecret;
    if (!secret) return true;
    if (!rawBody || !signature || !timestamp) return false;

    const sentAt = Number(timestamp);
    if (!Number.isFinite(sentAt)) return false;
    const skew = Math.abs(Date.now() / 1000 - sentAt);
    if (skew > MAX_CLOCK_SKEW_SECONDS) return false;

    const expected = Buffer.from(
      createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody.toString('utf8')}`)
        .digest('hex'),
      'utf8',
    );
    const provided = Buffer.from(signature.trim().toLowerCase(), 'utf8');

    if (provided.length !== expected.length) return false;
    return timingSafeEqual(expected, provided);
  }
}
