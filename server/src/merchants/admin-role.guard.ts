import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import {
  capabilitiesForAdminRole,
  type AdminCapability,
} from '@mori-pay/contracts';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ADMIN_CAPABILITIES_METADATA } from '../common/decorators/admin-capabilities.decorator.js';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    const userId = request.user?.userId;
    if (!userId) throw new ForbiddenException('Administrator access required');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true, adminStaffRole: true },
    });
    if (
      user?.role !== 'admin' ||
      user.status !== 'active' ||
      !user.adminStaffRole
    ) {
      throw new ForbiddenException('Administrator access required');
    }

    const required = this.reflector.getAllAndOverride<AdminCapability[]>(
      ADMIN_CAPABILITIES_METADATA,
      [context.getHandler(), context.getClass()],
    ) ?? ['admin:access'];
    const granted = capabilitiesForAdminRole(user.adminStaffRole);
    if (!required.every((capability) => granted.includes(capability))) {
      throw new ForbiddenException('Administrator capability required');
    }
    return true;
  }
}
