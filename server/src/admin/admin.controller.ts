import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  adminAuditQuerySchema,
  adminSearchQuerySchema,
  adminListQuerySchema,
  adminStaffRoleUpdateSchema,
  adminStaffSearchQuerySchema,
  adminUserStatusUpdateSchema,
  adminUserKycUpdateSchema,
  adminUserTierUpdateSchema,
  adminSessionQuerySchema,
  adminWebhookQuerySchema,
  adminReconciliationQuerySchema,
  adminReportQuerySchema,
  promotionInputSchema,
  promotionUpdateSchema,
  adminFeeRuleInputSchema,
  adminFeeRuleUpdateSchema,
  capabilitiesForAdminRole,
  type AdminAuditQuery,
  type AdminCapability,
  type AdminListQuery,
  type AdminSearchQuery,
  type AdminStaffRole,
  type AdminStaffSearchQuery,
  type AdminUserStatusUpdate,
  type AdminUserKycUpdate,
  type AdminUserTierUpdate,
  type AdminSessionQuery,
  type AdminWebhookQuery,
  type AdminReconciliationQuery,
  type AdminReportQuery,
  type PromotionInput,
  type PromotionUpdate,
  type AdminFeeRuleInput,
  type AdminFeeRuleUpdate,
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

  @Patch('users/:userId/status')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:user:write')
  updateUserStatus(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(adminUserStatusUpdateSchema))
    input: AdminUserStatusUpdate,
  ) {
    return this.admin.updateUserStatus(userId, input, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Patch('users/:userId/kyc')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:user:write')
  updateUserKyc(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(adminUserKycUpdateSchema))
    input: AdminUserKycUpdate,
  ) {
    return this.admin.updateUserKyc(userId, input, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Patch('users/:userId/tier')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:user:write')
  updateUserTier(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(adminUserTierUpdateSchema))
    input: AdminUserTierUpdate,
  ) {
    return this.admin.updateUserTier(userId, input, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('users/:userId/sessions/revoke')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:session:write')
  revokeUserSessions(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.revokeUserSessions(userId, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('users/:userId/devices/:deviceId/revoke')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:session:write')
  revokeUserDevice(
    @Param('userId') userId: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.revokeUserDevice(userId, deviceId, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Get('sessions')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:session:read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  sessions(
    @Query(new ZodValidationPipe(adminSessionQuerySchema))
    query: AdminSessionQuery,
  ) {
    return this.admin.sessions(query);
  }

  @Get('webhooks')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:webhook:read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  webhooks(
    @Query(new ZodValidationPipe(adminWebhookQuerySchema))
    query: AdminWebhookQuery,
  ) {
    return this.admin.webhookEvents(query);
  }

  @Get('reconciliation')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:reconciliation:read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  reconciliation(
    @Query(new ZodValidationPipe(adminReconciliationQuerySchema))
    query: AdminReconciliationQuery,
  ) {
    return this.admin.reconciliation(query);
  }

  @Post('reconciliation/run')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:reconciliation:write')
  runReconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.triggerReconciliation(user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Get('reports')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:report:read')
  reports(
    @Query(new ZodValidationPipe(adminReportQuerySchema))
    query: AdminReportQuery,
  ) {
    return this.admin.report(query);
  }

  @Get('health')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:health:read')
  health() {
    return this.admin.health();
  }

  @Get('promotions')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:promotion:read')
  promotions(
    @Query(new ZodValidationPipe(adminListQuerySchema))
    query: AdminListQuery,
  ) {
    return this.admin.listPromotions(query);
  }

  @Post('promotions')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:promotion:write')
  createPromotion(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(promotionInputSchema))
    input: PromotionInput,
  ) {
    return this.admin.createPromotion(input, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Patch('promotions/:promotionId')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:promotion:write')
  updatePromotion(
    @Param('promotionId') promotionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(promotionUpdateSchema))
    input: PromotionUpdate,
  ) {
    return this.admin.updatePromotion(promotionId, input, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Delete('promotions/:promotionId')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:promotion:write')
  deletePromotion(
    @Param('promotionId') promotionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.deletePromotion(promotionId, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('fee-rules')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:settings:write')
  createFeeRule(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(adminFeeRuleInputSchema))
    input: AdminFeeRuleInput,
  ) {
    return this.admin.createFeeRule(input, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Patch('fee-rules/:feeRuleId')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:settings:write')
  updateFeeRule(
    @Param('feeRuleId') feeRuleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(adminFeeRuleUpdateSchema))
    input: AdminFeeRuleUpdate,
  ) {
    return this.admin.updateFeeRule(feeRuleId, input, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Delete('fee-rules/:feeRuleId')
  @UseGuards(AdminRoleGuard)
  @RequireAdminCapabilities('admin:settings:write')
  deleteFeeRule(
    @Param('feeRuleId') feeRuleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.deleteFeeRule(feeRuleId, user.userId, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
}
