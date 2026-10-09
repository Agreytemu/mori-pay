import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { hmacSha256, randomToken } from '../common/crypto.js';
import { AppConfigService } from '../config/app-config.service.js';

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  typ: 'access';
  iat: number;
  exp: number;
};

export type SetupTokenPayload = {
  sub: string;
  typ: 'setup';
  iat: number;
  exp: number;
};

export type VerifiedToken = AccessTokenPayload | SetupTokenPayload;

const SETUP_TOKEN_TTL_SECONDS = 600;

function base64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Parses durations like `15m`, `30d`, `900` into seconds. */
function parseTtlSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) {
    const value = Number(ttl);
    return Number.isFinite(value) ? value : 0;
  }

  const amount = Number(match[1]);
  switch (match[2] ?? 's') {
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 3600;
    case 'd':
      return amount * 86400;
    default:
      return amount;
  }
}

/**
 * Mints and verifies the app's own HS256 tokens (access + registration setup)
 * and opaque refresh tokens. Kept dependency-free on purpose.
 */
@Injectable()
export class TokenService {
  constructor(private readonly config: AppConfigService) {}

  createAccessToken(
    userId: string,
    sessionId: string,
  ): { token: string; expiresIn: number } {
    const expiresIn = parseTtlSeconds(this.config.jwt.accessTtl);
    const now = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      typ: 'access',
      iat: now,
      exp: now + expiresIn,
    };

    return {
      token: this.sign(payload, this.config.jwt.accessSecret),
      expiresIn,
    };
  }

  createSetupToken(phone: string): { token: string; expiresIn: number } {
    const now = Math.floor(Date.now() / 1000);
    const payload: SetupTokenPayload = {
      sub: phone,
      typ: 'setup',
      iat: now,
      exp: now + SETUP_TOKEN_TTL_SECONDS,
    };

    return {
      token: this.sign(payload, this.config.jwt.accessSecret),
      expiresIn: SETUP_TOKEN_TTL_SECONDS,
    };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const payload = this.verify(token, this.config.jwt.accessSecret);
    if (payload.typ !== 'access') throw new Error('Unexpected token type');
    return payload;
  }

  verifySetupToken(token: string): SetupTokenPayload {
    const payload = this.verify(token, this.config.jwt.accessSecret);
    if (payload.typ !== 'setup') throw new Error('Unexpected token type');
    return payload;
  }

  createRefreshToken(): {
    token: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const token = randomToken(32);
    const ttl = parseTtlSeconds(this.config.jwt.refreshTtl);
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  }

  hashRefreshToken(token: string): string {
    return hmacSha256(token, this.config.jwt.refreshSecret);
  }

  private sign(payload: VerifiedToken, secret: string): string {
    const header = base64Url({ alg: 'HS256', typ: 'JWT' });
    const body = base64Url(payload);
    const data = `${header}.${body}`;
    const signature = createHmac('sha256', secret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  private verify(token: string, secret: string): VerifiedToken {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    const [header, body, signature] = parts;
    const expected = createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const given = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
      throw new Error('Invalid token signature');
    }

    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as VerifiedToken;

    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    return payload;
  }
}
