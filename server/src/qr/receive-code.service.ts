import { BadRequestException, Injectable } from '@nestjs/common';

import type { ReceiveCode } from '@mori-pay/contracts';

import { hmacSha256, safeEqualHex } from '../common/crypto.js';
import { AppConfigService } from '../config/app-config.service.js';

const CODE_VERSION = 'mp1';
const CODE_TTL_SECONDS = 600;

type ReceiveCodePayload = { u: string; e: number };

/**
 * Mints and verifies the app's own receive codes (the payload rendered in a
 * per-user receive QR). Stateless: identity is proven by the HMAC signature,
 * so verification never touches the database.
 */
@Injectable()
export class ReceiveCodeService {
  constructor(private readonly config: AppConfigService) {}

  /** Dedicated secret when provided, otherwise reuse the access-token secret. */
  private get secret(): string {
    return this.config.receiveQrSecret ?? this.config.jwt.accessSecret;
  }

  issue(userId: string): ReceiveCode {
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + CODE_TTL_SECONDS;
    const payload: ReceiveCodePayload = { u: userId, e: expiresAtSeconds };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = hmacSha256(`${CODE_VERSION}.${body}`, this.secret);
    return {
      code: `${CODE_VERSION}.${body}.${signature}`,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    };
  }

  /** Returns the owning user id, or throws if the code is forged or expired. */
  verify(code: string): string {
    const parts = code.trim().split('.');
    if (parts.length !== 3 || parts[0] !== CODE_VERSION) {
      throw new BadRequestException('This receive code is invalid');
    }

    const [, body, signature] = parts;
    const expected = hmacSha256(`${CODE_VERSION}.${body}`, this.secret);
    if (!safeEqualHex(expected, signature)) {
      throw new BadRequestException('This receive code is invalid');
    }

    let payload: ReceiveCodePayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as ReceiveCodePayload;
    } catch {
      throw new BadRequestException('This receive code is invalid');
    }

    if (typeof payload.u !== 'string' || typeof payload.e !== 'number') {
      throw new BadRequestException('This receive code is invalid');
    }
    if (payload.e * 1000 < Date.now()) {
      throw new BadRequestException('This receive code has expired');
    }

    return payload.u;
  }
}
