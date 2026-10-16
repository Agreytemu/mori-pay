import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  adminAuditQuerySchema,
  adminSearchQuerySchema,
  adminListQuerySchema,
  adminStaffRoleUpdateSchema,
  adminStaffSearchQuerySchema,
  capabilitiesForAdminRole,
  type AdminAuditQuery,
  type AdminCapability,
  type AdminListQuery,
  type AdminSearchQuery,
  type AdminStaffRole,
  type AdminStaffSearchQuery,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAdminCapabilities } from '../common/decorators/admin-capabilities.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AdminRoleGuard } from '../merchants/admin-role.guard.js';
import { AdminService } from './admin.service.js';

export type AdminSession = {
  userId: string;
  role: 'admin';
  staffRole: AdminStaffRole;
  capabilities: AdminCapability[];
};

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('session')
  @UseGuards(AdminRoleGuard)
  async session(@CurrentUser() user: AuthenticatedUser): Promise<AdminSession> {
    const staffRole = await this.admin.staffRole(user.userId);
    return this.toAdminSession(user.userId, staffRole);
  }

  private toAdminSession(userId: string, staffRole: AdminStaffRole): AdminSession {
    return {
      userId,
      role: 'admin',
      staffRole,
      capabilities: [...capabilitiesForAdminRole(staffRole)],
    };
  }

  @Get('overview')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:overview')
  overview() {
    return this.admin.overview();
  }

  @Get('settings')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:settings:read')
  settings() {
    return this.admin.systemSettings();
  }

  @Get('audit')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:audit:read')
  audit(
    @Query(new ZodValidationPipe(adminAuditQuerySchema))
    query: AdminAuditQuery,
  ) {
    return this.admin.audit(query);
  }

  @Get('merchants')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:merchant:read')
  merchants(
    @Query(new ZodValidationPipe(adminListQuerySchema))
    query: AdminListQuery,
  ) {
    return this.admin.merchantAccounts(query);
  }

  @Get('users')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:user:read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  users(
    @Query(new ZodValidationPipe(adminSearchQuerySchema))
    query: AdminSearchQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.searchUsers(query, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Get('users/:userId')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:user:read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  user(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.userDetail(userId, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Get('transactions')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:transaction:read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  transactions(
    @Query(new ZodValidationPipe(adminSearchQuerySchema))
    query: AdminSearchQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.searchTransactions(query, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Get('transactions/:transactionId')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:transaction:read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  transaction(
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.transactionDetail(transactionId, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Get('staff')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:staff:manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  staff(
    @Query(new ZodValidationPipe(adminStaffSearchQuerySchema))
    query: AdminStaffSearchQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.searchStaff(query, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Patch('staff/:staffUserId/role')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:staff:manage')
  updateStaffRole(
    @Param('staffUserId') staffUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(adminStaffRoleUpdateSchema))
    input: { role: AdminStaffRole | null },
  ) {
    return this.admin.updateStaffRole(staffUserId, input.role, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
}
