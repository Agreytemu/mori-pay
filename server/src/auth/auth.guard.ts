import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../common/constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { TokenService } from './token.service.js';

type RequestWithUser = Request & { user?: AuthenticatedUser };

/**
 * Verifies the bearer access token and attaches the principal to the request.
 *
 * The token's `sid` is the id of the `RefreshToken` session it was minted
 * from, so a revoked session (logout, password reset, rotation) immediately
 * invalidates every access token tied to it — even before the JWT expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.sid },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is no longer active');
    }

    request.user = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }
}
