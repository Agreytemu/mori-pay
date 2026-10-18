import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

@Injectable()
export class ClickPesaWebhookSignatureService {
  constructor(private readonly config: AppConfigService) {}

  verify(payload: unknown): boolean {
    const key = this.config.clickpesa.checksumKey;
    if (!key) return !this.config.isProduction;
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return false;
    }

    const body = payload as Record<string, unknown>;
    if (typeof body.checksum !== 'string' || body.checksum.length !== 64) {
      return false;
    }
    if (
      body.checksumMethod !== undefined &&
      (typeof body.checksumMethod !== 'string' ||
        body.checksumMethod.toUpperCase() !== 'HMAC-SHA256')
    ) {
      return false;
    }

    const unsignedPayload = Object.fromEntries(
      Object.entries(body).filter(
        ([name]) => name !== 'checksum' && name !== 'checksumMethod',
      ),
    );
    const expected = createHmac('sha256', key)
      .update(JSON.stringify(canonicalize(unsignedPayload)))
      .digest();
    const provided = Buffer.from(body.checksum, 'hex');
    return provided.length === expected.length && timingSafeEqual(expected, provided);
  }
}
