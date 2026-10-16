import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  AdminStaffRole,
  AdminStaffSearchPage,
  AdminStaffSearchQuery,
  AdminAuditPage,
  AdminAuditQuery,
  AdminMerchantAccountPage,
  AdminListQuery,
  AdminOverview,
  AdminSearchQuery,
  AdminSystemSettings,
  AdminStaffRoleUpdate,
  AdminTransactionDetail,
  AdminTransactionSearchPage,
  AdminUserDetail,
  AdminUserSearchPage,
  AdminUserStatusUpdate,
  AdminUserKycUpdate,
  AdminUserTierUpdate,
  AdminSessionQuery,
  AdminSessionSearchPage,
  AdminWebhookQuery,
  AdminWebhookEventPage,
  AdminReconciliationQuery,
  AdminReconciliationPage,
  AdminReportQuery,
  AdminReport,
  AdminHealth,
  Promotion,
  PromotionInput,
  PromotionUpdate,
  PromotionPage,
  AdminFeeRule,
  AdminFeeRuleInput,
  AdminFeeRuleUpdate,
} from '@mori-pay/contracts';

import { Prisma } from '../generated/prisma/client.js';
import type {
  Promotion as PromotionRow,
  FeeRule as FeeRuleRow,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ReconciliationSweeper } from '../webhooks/reconciliation.sweeper.js';

export type AdminAuditContext = { ip?: string; userAgent?: string };

/** A user is shown as online when seen within this window. */
const ONLINE_WINDOW_MS = 15 * 60 * 1000;

type UserActivity = {
  isOnline: boolean;
  lastActiveAt: Date | null;
  activeSessions: number;
  deviceCount: number;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly sweeper: ReconciliationSweeper,
  ) {}

  async staffRole(userId: string): Promise<AdminStaffRole> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { adminStaffRole: true },
    });
    if (!user?.adminStaffRole) throw new ForbiddenException('Administrator access required');
    return user.adminStaffRole;
  }

  async searchStaff(
    query: AdminStaffSearchQuery,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminStaffSearchPage> {
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'admin.staff.search',
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: {
          page: query.page,
          pageSize: query.pageSize,
          queryLength: query.q.length,
        },
      },
    });
    const where = {
      status: 'active' as const,
      AND: [
        {
          OR: [
            { emailVerifiedAt: { not: null } },
            { adminStaffRole: { not: null } },
          ],
        },
        {
          OR: [
            { id: query.q },
            { phone: { startsWith: query.q } },
            { email: { startsWith: query.q, mode: 'insensitive' as const } },
            { fullName: { contains: query.q, mode: 'insensitive' as const } },
            { memberId: { startsWith: query.q, mode: 'insensitive' as const } },
          ],
        },
      ],
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          memberId: true,
          status: true,
          adminStaffRole: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: users.map((user) => ({
        id: user.id,
        name: user.fullName,
        phone: maskPhone(user.phone),
        email: maskEmail(user.email),
        memberId: maskIdentifier(user.memberId),
        status: user.status,
        staffRole: user.adminStaffRole,
        createdAt: user.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async updateStaffRole(
    staffUserId: string,
    role: AdminStaffRoleUpdate['role'],
    actorId: string,
    context: AdminAuditContext,
  ): Promise<{ userId: string; staffRole: AdminStaffRole | null }> {
    if (staffUserId === actorId) {
      throw new ForbiddenException('You cannot change your own administrator role');
    }
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: { role: true, status: true, adminStaffRole: true },
      });
      if (
        actor?.role !== 'admin' ||
        actor.status !== 'active' ||
        actor.adminStaffRole !== 'super_admin'
      ) {
        throw new ForbiddenException('Super administrator access required');
      }

      const target = await tx.user.findUnique({
        where: { id: staffUserId },
        select: { id: true, status: true, emailVerifiedAt: true, adminStaffRole: true },
      });
      if (!target || target.status !== 'active') {
        throw new NotFoundException('Active user record not found');
      }
      if (role && !target.adminStaffRole && !target.emailVerifiedAt) {
        throw new ForbiddenException('A verified email is required before granting staff access');
      }

      if (target.adminStaffRole === 'super_admin' && role !== 'super_admin') {
        const superAdminCount = await tx.user.count({
          where: {
            role: 'admin',
            status: 'active',
            adminStaffRole: 'super_admin',
          },
        });
        if (superAdminCount <= 1) {
          throw new ForbiddenException('The last active super administrator cannot be removed');
        }
      }

      await tx.user.update({
        where: { id: staffUserId },
        data: {
          role: role ? 'admin' : 'user',
          adminStaffRole: role,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: staffUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: role ? 'admin.staff.role.update' : 'admin.staff.role.revoke',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: {
            targetId: staffUserId,
            previousRole: target.adminStaffRole,
            nextRole: role,
          },
        },
      });
      return { userId: staffUserId, staffRole: role };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async overview(): Promise<AdminOverview> {
    const [
      totalUsers,
      activeUsers,
      restrictedUsers,
      pendingPayment,
      awaitingReview,
      approvedApplications,
      rejectedApplications,
      activeMerchants,
      suspendedMerchants,
      revokedMerchants,
      completedTransactions,
      pendingTransactions,
      processingTransactions,
      failedTransactions,
      cancelledTransactions,
      awaitingWebhooks,
      failedWebhooks,
      transactionsByChannel,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { status: 'restricted' } }),
      this.prisma.merchantApplication.count({ where: { status: 'pending_payment' } }),
      this.prisma.merchantApplication.count({ where: { status: 'awaiting_review' } }),
      this.prisma.merchantApplication.count({ where: { status: 'approved' } }),
      this.prisma.merchantApplication.count({ where: { status: 'rejected' } }),
      this.prisma.merchantAccount.count({ where: { status: 'active' } }),
      this.prisma.merchantAccount.count({ where: { status: 'suspended' } }),
      this.prisma.merchantAccount.count({ where: { status: 'revoked' } }),
      this.prisma.transaction.count({ where: { status: 'completed' } }),
      this.prisma.transaction.count({ where: { status: 'pending' } }),
      this.prisma.transaction.count({ where: { status: 'processing' } }),
      this.prisma.transaction.count({ where: { status: 'failed' } }),
      this.prisma.transaction.count({ where: { status: 'cancelled' } }),
      this.prisma.ablinerWebhookEvent.count({
        where: { processedAt: null },
      }),
      this.prisma.ablinerWebhookEvent.count({
        where: { error: { not: null } },
      }),
      this.prisma.transaction.groupBy({
        by: ['channel'],
        _count: { _all: true },
        orderBy: { channel: 'asc' },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      users: {
        total: totalUsers,
        active: activeUsers,
        restricted: restrictedUsers,
      },
      merchantApplications: {
        pendingPayment,
        awaitingReview,
        approved: approvedApplications,
        rejected: rejectedApplications,
      },
      merchantAccounts: {
        active: activeMerchants,
        suspended: suspendedMerchants,
        revoked: revokedMerchants,
      },
      transactions: {
        completed: completedTransactions,
        pending: pendingTransactions,
        processing: processingTransactions,
        failed: failedTransactions,
        cancelled: cancelledTransactions,
        byChannel: transactionsByChannel.map((item) => ({
          channel: item.channel,
          count: item._count._all,
        })),
      },
      webhookEvents: {
        awaitingProcessing: awaitingWebhooks,
        failedProcessing: failedWebhooks,
      },
    };
  }

  async systemSettings(): Promise<AdminSystemSettings> {
    const [merchantConfiguration, feeRules] = await Promise.all([
      this.prisma.merchantConfiguration.findUnique({
        where: { id: 'merchant-registration' },
        select: { registrationFeeAmount: true },
      }),
      this.prisma.feeRule.findMany({
        select: {
          id: true,
          type: true,
          channel: true,
          flat: true,
          percentage: true,
          minAmount: true,
          maxAmount: true,
          active: true,
          createdAt: true,
        },
        orderBy: [{ type: 'asc' }, { channel: 'asc' }, { minAmount: 'asc' }],
        take: 200,
      }),
    ]);
    const limits = this.config.limits;
    const abliner = this.config.abliner;
    const email = this.config.email;
    const sms = this.config.sms;

    return {
      generatedAt: new Date().toISOString(),
      merchantRegistrationFee:
        merchantConfiguration?.registrationFeeAmount?.toString() ?? null,
      feeRules: feeRules.map((rule) => ({
        id: rule.id,
        type: rule.type,
        channel: rule.channel,
        flat: rule.flat.toString(),
        percentage: rule.percentage,
        minAmount: rule.minAmount.toString(),
        maxAmount: rule.maxAmount?.toString() ?? null,
        active: rule.active,
        createdAt: rule.createdAt.toISOString(),
      })),
      tierLimits: {
        standard: {
          dailyOutflow: limits.standard.dailyOutflow.toString(),
          perTransaction: limits.standard.perTransaction.toString(),
        },
        verified: {
          dailyOutflow: limits.verified.dailyOutflow.toString(),
          perTransaction: limits.verified.perTransaction.toString(),
        },
      },
      reconciliation: this.config.reconciliation,
      integrations: [
        {
          name: 'Abliner',
          configuration: abliner.baseUrl && abliner.apiKey && abliner.webhookSecret
            ? 'configured'
            : 'incomplete',
        },
        {
          name: 'Email',
          configuration: email.apiKey || (email.smtp.host && email.smtp.user && email.smtp.pass)
            ? 'configured'
            : 'incomplete',
        },
        {
          name: 'SMS',
          configuration: sms.provider && sms.apiKey ? 'configured' : 'incomplete',
        },
      ],
    };
  }

  async audit(query: AdminAuditQuery): Promise<AdminAuditPage> {
    const where = {
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' as const } } : {}),
      ...((query.from || query.to)
        ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
        : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          createdAt: true,
          ip: true,
          userAgent: true,
          metadata: true,
          user: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: records.map((record) => ({
        id: record.id,
        action: record.action,
        createdAt: record.createdAt.toISOString(),
        ip: record.ip,
        userAgent: record.userAgent,
        metadata: record.metadata ?? null,
        actor: record.user
          ? { id: record.user.id, name: record.user.fullName }
          : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async merchantAccounts(query: AdminListQuery): Promise<AdminMerchantAccountPage> {
    const [accounts, total] = await Promise.all([
      this.prisma.merchantAccount.findMany({
        select: {
          id: true,
          name: true,
          identifier: true,
          category: true,
          phone: true,
          status: true,
          createdAt: true,
          owner: { select: { fullName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.merchantAccount.count(),
    ]);
    return {
      items: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        identifier: account.identifier,
        category: account.category,
        phone: account.phone ?? undefined,
        status: account.status,
        ownerName: account.owner.fullName,
        ownerPhone: account.owner.phone ?? undefined,
        createdAt: account.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async searchUsers(
    query: AdminSearchQuery,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminUserSearchPage> {
    await this.recordSensitiveSearch('admin.user.search', actorId, query, context);
    const search = query.q;
    const where = search
      ? {
          OR: [
            { id: search },
            { phone: { startsWith: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { memberId: { startsWith: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          memberId: true,
          status: true,
          tier: true,
          kycLevel: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const ids = users.map((user) => user.id);
    const activity = await this.loadUserActivity(ids);

    return {
      items: users.map((user) => {
        const record = activity.get(user.id);
        return {
          id: user.id,
          name: user.fullName,
          phone: maskPhone(user.phone),
          email: maskEmail(user.email),
          memberId: maskIdentifier(user.memberId),
          status: user.status,
          tier: user.tier,
          kycLevel: user.kycLevel,
          isOnline: record?.isOnline ?? false,
          lastActiveAt: record?.lastActiveAt?.toISOString() ?? null,
          activeSessions: record?.activeSessions ?? 0,
          deviceCount: record?.deviceCount ?? 0,
          createdAt: user.createdAt.toISOString(),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  /**
   * Batched presence lookup for a page of users. A user is considered online
   * when they hold a live refresh token or a device that checked in recently,
   * because `lastActiveAt` advances on every session refresh.
   */
  private async loadUserActivity(
    userIds: string[],
  ): Promise<Map<string, UserActivity>> {
    const activity = new Map<string, UserActivity>();
    if (userIds.length === 0) return activity;

    const now = Date.now();
    const onlineSince = new Date(now - ONLINE_WINDOW_MS);

    const [sessions, devices] = await Promise.all([
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          revokedAt: null,
          expiresAt: { gt: new Date(now) },
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.device.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
        _max: { lastActiveAt: true },
      }),
    ]);

    for (const id of userIds) {
      activity.set(id, {
        isOnline: false,
        lastActiveAt: null,
        activeSessions: 0,
        deviceCount: 0,
      });
    }

    for (const session of sessions) {
      const record = activity.get(session.userId);
      if (!record) continue;
      record.activeSessions = session._count._all;
      const seenAt = session._max.createdAt ?? null;
      if (seenAt && (!record.lastActiveAt || seenAt > record.lastActiveAt)) {
        record.lastActiveAt = seenAt;
      }
      if (seenAt && seenAt >= onlineSince) record.isOnline = true;
    }

    for (const device of devices) {
      const record = activity.get(device.userId);
      if (!record) continue;
      record.deviceCount = device._count._all;
      const seenAt = device._max.lastActiveAt ?? null;
      if (seenAt && (!record.lastActiveAt || seenAt > record.lastActiveAt)) {
        record.lastActiveAt = seenAt;
      }
      if (seenAt && seenAt >= onlineSince) record.isOnline = true;
    }

    return activity;
  }

  async searchTransactions(
    query: AdminSearchQuery,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminTransactionSearchPage> {
    await this.recordSensitiveSearch('admin.transaction.search', actorId, query, context);
    const search = query.q;
    const where = search
      ? {
          OR: [
            { id: search },
            { reference: { contains: search, mode: 'insensitive' as const } },
            { internalReference: { contains: search, mode: 'insensitive' as const } },
            { providerRef: { contains: search, mode: 'insensitive' as const } },
            { counterparty: { contains: search, mode: 'insensitive' as const } },
            {
              user: {
                is: {
                  OR: [
                    { id: search },
                    { phone: { startsWith: search } },
                    { fullName: { contains: search, mode: 'insensitive' as const } },
                    { memberId: { startsWith: search, mode: 'insensitive' as const } },
                  ],
                },
              },
            },
          ],
        }
      : {};
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          reference: true,
          type: true,
          status: true,
          category: true,
          channel: true,
          direction: true,
          amount: true,
          fee: true,
          total: true,
          currency: true,
          provider: true,
          providerStatus: true,
          createdAt: true,
          settledAt: true,
          user: {
            select: {
              fullName: true,
              phone: true,
              memberId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: transactions.map((transaction) => ({
        id: transaction.id,
        reference: maskIdentifier(transaction.reference),
        type: transaction.type,
        status: transaction.status,
        category: transaction.category,
        channel: transaction.channel,
        direction: transaction.direction,
        amount: transaction.amount.toString(),
        fee: transaction.fee.toString(),
        total: transaction.total.toString(),
        currency: transaction.currency,
        provider: transaction.provider,
        providerStatus: transaction.providerStatus,
        createdAt: transaction.createdAt.toISOString(),
        settledAt: transaction.settledAt?.toISOString() ?? null,
        user: {
          name: transaction.user.fullName,
          phone: maskPhone(transaction.user.phone),
          memberId: maskIdentifier(transaction.user.memberId),
        },
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async userDetail(
    userId: string,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminUserDetail> {
    await this.recordDetailAccess('admin.user.view', userId, actorId, context);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        memberId: true,
        status: true,
        tier: true,
        kycLevel: true,
        createdAt: true,
        wallet: {
          select: {
            currency: true,
            status: true,
            accountNumber: true,
          },
        },
        devices: {
          select: {
            id: true,
            name: true,
            platform: true,
            lastActiveAt: true,
            isCurrent: true,
          },
          orderBy: { lastActiveAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!user) throw new NotFoundException('User record not found');
    const [activeSessions, revokedSessions] = await Promise.all([
      this.prisma.refreshToken.count({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.refreshToken.count({
        where: { userId, revokedAt: { not: null } },
      }),
    ]);

    return {
      id: user.id,
      name: user.fullName,
      phone: maskPhone(user.phone),
      email: maskEmail(user.email),
      memberId: maskIdentifier(user.memberId),
      status: user.status,
      tier: user.tier,
      kycLevel: user.kycLevel,
      createdAt: user.createdAt.toISOString(),
      wallet: user.wallet
        ? {
            currency: user.wallet.currency,
            status: user.wallet.status,
            accountNumber: maskIdentifier(user.wallet.accountNumber),
          }
        : null,
      devices: user.devices.map((device) => ({
        id: device.id,
        name: device.name,
        platform: device.platform,
        lastActiveAt: device.lastActiveAt.toISOString(),
        isCurrent: device.isCurrent,
      })),
      sessions: {
        active: activeSessions,
        revoked: revokedSessions,
      },
    };
  }

  async transactionDetail(
    transactionId: string,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminTransactionDetail> {
    await this.recordDetailAccess('admin.transaction.view', transactionId, actorId, context);
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        reference: true,
        internalReference: true,
        status: true,
        type: true,
        category: true,
        channel: true,
        direction: true,
        amount: true,
        fee: true,
        total: true,
        currency: true,
        provider: true,
        providerStatus: true,
        providerRef: true,
        createdAt: true,
        updatedAt: true,
        settledAt: true,
        user: { select: { fullName: true, phone: true, memberId: true } },
        ledgerEntries: {
          select: {
            direction: true,
            amount: true,
            createdAt: true,
            ledgerAccount: { select: { kind: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!transaction) throw new NotFoundException('Transaction record not found');

    const reconciliationReferences = [
      transaction.reference,
      transaction.internalReference,
      transaction.providerRef,
    ].filter((reference): reference is string => reference !== null);
    const reconciliationEvents = reconciliationReferences.length
      ? await this.prisma.ablinerWebhookEvent.findMany({
          where: { transactionReference: { in: reconciliationReferences } },
          select: {
            event: true,
            processedAt: true,
            error: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        })
      : [];

    return {
      id: transaction.id,
      reference: maskIdentifier(transaction.reference),
      type: transaction.type,
      status: transaction.status,
      category: transaction.category,
      channel: transaction.channel,
      direction: transaction.direction,
      amount: transaction.amount.toString(),
      fee: transaction.fee.toString(),
      total: transaction.total.toString(),
      currency: transaction.currency,
      provider: transaction.provider,
      providerStatus: transaction.providerStatus,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
      settledAt: transaction.settledAt?.toISOString() ?? null,
      user: {
        name: transaction.user.fullName,
        phone: maskPhone(transaction.user.phone),
        memberId: maskIdentifier(transaction.user.memberId),
      },
      ledgerEntries: transaction.ledgerEntries.map((entry) => ({
        accountKind: entry.ledgerAccount.kind,
        direction: entry.direction,
        amount: entry.amount.toString(),
        createdAt: entry.createdAt.toISOString(),
      })),
      reconciliationEvents: reconciliationEvents.map((event) => ({
        event: event.event,
        processed: event.processedAt !== null,
        errorPresent: event.error !== null,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async updateUserStatus(
    userId: string,
    input: AdminUserStatusUpdate,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<{ id: string; status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, role: true },
      });
      if (!target) throw new NotFoundException('User record not found');
      if (target.role === 'admin' && input.status !== 'active') {
        throw new ConflictException(
          'Administrator accounts are managed from Staff access, not here',
        );
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: input.status },
        select: { id: true, status: true },
      });
      if (input.status !== 'active') {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.user.status.update',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: {
            targetId: userId,
            previousStatus: target.status,
            status: updated.status,
            reason: input.reason ?? null,
          },
        },
      });
      return updated;
    });
  }

  async updateUserKyc(
    userId: string,
    input: AdminUserKycUpdate,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<{ id: string; kycLevel: number }> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, kycLevel: true },
      });
      if (!target) throw new NotFoundException('User record not found');
      const updated = await tx.user.update({
        where: { id: userId },
        data: { kycLevel: input.kycLevel },
        select: { id: true, kycLevel: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.user.kyc.update',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: {
            targetId: userId,
            previousKycLevel: target.kycLevel,
            kycLevel: updated.kycLevel,
            reason: input.reason ?? null,
          },
        },
      });
      return updated;
    });
  }

  async updateUserTier(
    userId: string,
    input: AdminUserTierUpdate,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<{ id: string; tier: string }> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, tier: true },
      });
      if (!target) throw new NotFoundException('User record not found');
      const updated = await tx.user.update({
        where: { id: userId },
        data: { tier: input.tier },
        select: { id: true, tier: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.user.tier.update',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: {
            targetId: userId,
            previousTier: target.tier,
            tier: updated.tier,
            reason: input.reason ?? null,
          },
        },
      });
      return updated;
    });
  }

  async revokeUserSessions(
    userId: string,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<{ revoked: number }> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('User record not found');
      const result = await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.user.sessions.revoke',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { targetId: userId, revoked: result.count },
        },
      });
      return { revoked: result.count };
    });
  }

  async revokeUserDevice(
    userId: string,
    deviceId: string,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<{ id: string; revokedAt: string }> {
    const revokedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findFirst({
        where: { id: deviceId, userId },
        select: { id: true },
      });
      if (!device) throw new NotFoundException('Device record not found');
      await tx.refreshToken.updateMany({
        where: { deviceId, revokedAt: null },
        data: { revokedAt },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.user.device.revoke',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { targetId: userId, deviceId },
        },
      });
      return { id: deviceId, revokedAt: revokedAt.toISOString() };
    });
  }

  async sessions(query: AdminSessionQuery): Promise<AdminSessionSearchPage> {
    const now = new Date();
    const userFilter = query.q
      ? {
          user: {
            is: {
              OR: [
                { id: query.q },
                { phone: { startsWith: query.q } },
                { memberId: { startsWith: query.q, mode: 'insensitive' as const } },
                { fullName: { contains: query.q, mode: 'insensitive' as const } },
              ],
            },
          },
        }
      : {};
    const where: Prisma.RefreshTokenWhereInput = {
      ...userFilter,
      ...(query.state === 'active'
        ? { revokedAt: null, expiresAt: { gt: now } }
        : {}),
      ...(query.state === 'revoked' ? { revokedAt: { not: null } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.refreshToken.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          device: {
            select: { name: true, platform: true, lastActiveAt: true },
          },
          user: {
            select: { id: true, fullName: true, memberId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.refreshToken.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        user: {
          id: row.user.id,
          name: row.user.fullName,
          memberId: maskIdentifier(row.user.memberId),
        },
        device: row.device
          ? { name: row.device.name, platform: row.device.platform }
          : null,
        isActive: row.revokedAt === null && row.expiresAt > now,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        revokedAt: row.revokedAt?.toISOString() ?? null,
        lastActiveAt: row.device?.lastActiveAt.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async webhookEvents(query: AdminWebhookQuery): Promise<AdminWebhookEventPage> {
    const where: Prisma.AblinerWebhookEventWhereInput = {
      ...(query.state === 'pending' ? { processedAt: null, error: null } : {}),
      ...(query.state === 'processed' ? { processedAt: { not: null } } : {}),
      ...(query.state === 'failed' ? { error: { not: null } } : {}),
      ...(query.q
        ? {
            OR: [
              { eventId: query.q },
              { event: { contains: query.q, mode: 'insensitive' as const } },
              {
                transactionReference: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.ablinerWebhookEvent.findMany({
        where,
        select: {
          id: true,
          eventId: true,
          event: true,
          transactionReference: true,
          processedAt: true,
          error: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ablinerWebhookEvent.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        eventId: row.eventId,
        event: row.event,
        transactionReference: maskIdentifier(row.transactionReference),
        processed: row.processedAt !== null,
        errorPresent: row.error !== null,
        error: row.error,
        createdAt: row.createdAt.toISOString(),
        processedAt: row.processedAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async reconciliation(
    query: AdminReconciliationQuery,
  ): Promise<AdminReconciliationPage> {
    const { staleSeconds } = this.config.reconciliation;
    const cutoff = new Date(Date.now() - staleSeconds * 1000);
    const where: Prisma.TransactionWhereInput = {
      provider: 'abliner',
      ...(query.state === 'all'
        ? {}
        : {
            status: { in: ['pending', 'processing'] },
            ...(query.state === 'stale' ? { createdAt: { lt: cutoff } } : {}),
          }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          reference: true,
          type: true,
          status: true,
          channel: true,
          amount: true,
          currency: true,
          provider: true,
          providerStatus: true,
          createdAt: true,
          settledAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    const now = Date.now();
    return {
      items: rows.map((row) => ({
        id: row.id,
        reference: maskIdentifier(row.reference),
        type: row.type,
        status: row.status,
        channel: row.channel,
        amount: row.amount.toString(),
        currency: row.currency,
        provider: row.provider,
        providerStatus: row.providerStatus,
        ageSeconds: Math.max(0, Math.round((now - row.createdAt.getTime()) / 1000)),
        createdAt: row.createdAt.toISOString(),
        settledAt: row.settledAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      staleSeconds,
    };
  }

  async triggerReconciliation(
    actorId: string,
    context: AdminAuditContext,
  ): Promise<{ checked: number }> {
    const checked = await this.sweeper.sweep();
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'admin.reconciliation.trigger',
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { checked },
      },
    });
    return { checked };
  }

  async report(query: AdminReportQuery): Promise<AdminReport> {
    const dateFilter = query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {};
    const [
      usersCreated,
      activeUsers,
      restrictedUsers,
      totalTransactions,
      completedTransactions,
      failedTransactions,
      pendingTransactions,
      volumeAgg,
      feesAgg,
      byChannel,
      byStatus,
      applications,
      approvedApplications,
      activeAccounts,
    ] = await Promise.all([
      this.prisma.user.count({ where: dateFilter }),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { status: 'restricted' } }),
      this.prisma.transaction.count({ where: dateFilter }),
      this.prisma.transaction.count({
        where: { ...dateFilter, status: 'completed' },
      }),
      this.prisma.transaction.count({
        where: { ...dateFilter, status: 'failed' },
      }),
      this.prisma.transaction.count({
        where: { ...dateFilter, status: { in: ['pending', 'processing'] } },
      }),
      this.prisma.transaction.aggregate({
        where: { ...dateFilter, status: 'completed' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...dateFilter, status: 'completed' },
        _sum: { fee: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['channel'],
        where: dateFilter,
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { channel: 'asc' },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.merchantApplication.count({ where: dateFilter }),
      this.prisma.merchantApplication.count({
        where: { ...dateFilter, status: 'approved' },
      }),
      this.prisma.merchantAccount.count({ where: { status: 'active' } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      from: query.from?.toISOString() ?? null,
      to: query.to?.toISOString() ?? null,
      users: {
        created: usersCreated,
        active: activeUsers,
        restricted: restrictedUsers,
      },
      transactions: {
        total: totalTransactions,
        completed: completedTransactions,
        failed: failedTransactions,
        pending: pendingTransactions,
        volume: (volumeAgg._sum.amount ?? 0n).toString(),
        fees: (feesAgg._sum.fee ?? 0n).toString(),
        currency: 'TZS',
        byChannel: byChannel.map((row) => ({
          channel: row.channel,
          count: row._count._all,
          volume: (row._sum.amount ?? 0n).toString(),
        })),
        byStatus: byStatus.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
      },
      merchants: {
        applications,
        approved: approvedApplications,
        activeAccounts,
      },
    };
  }

  async health(): Promise<AdminHealth> {
    const started = Date.now();
    let databaseOk = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseOk = false;
    }
    const responseMs = Date.now() - started;
    const [awaiting, failed] = await Promise.all([
      this.prisma.ablinerWebhookEvent.count({ where: { processedAt: null } }),
      this.prisma.ablinerWebhookEvent.count({
        where: { error: { not: null } },
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      status: databaseOk ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      environment: this.config.nodeEnv,
      database: { ok: databaseOk, responseMs },
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      webhooks: {
        awaitingProcessing: awaiting,
        failedProcessing: failed,
      },
    };
  }

  async listPromotions(query: AdminListQuery): Promise<PromotionPage> {
    const [rows, total] = await Promise.all([
      this.prisma.promotion.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.promotion.count(),
    ]);
    return {
      items: rows.map((row) => toPromotion(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async createPromotion(
    input: PromotionInput,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<Promotion> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          title: input.title,
          body: input.body,
          placement: input.placement,
          imageUrl: input.imageUrl ?? null,
          active: input.active,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.promotion.create',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { promotionId: created.id, title: created.title },
        },
      });
      return toPromotion(created);
    });
  }

  async updatePromotion(
    id: string,
    input: PromotionUpdate,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<Promotion> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.promotion.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Promotion not found');
      const updated = await tx.promotion.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.placement !== undefined ? { placement: input.placement } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.promotion.update',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { promotionId: id },
        },
      });
      return toPromotion(updated);
    });
  }

  async deletePromotion(
    id: string,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.promotion.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Promotion not found');
      await tx.promotion.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.promotion.delete',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { promotionId: id, title: existing.title },
        },
      });
    });
  }

  async createFeeRule(
    input: AdminFeeRuleInput,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminFeeRule> {
    assertFeeRuleRange(input.minAmount, input.maxAmount ?? null);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.feeRule.create({
        data: {
          type: input.type,
          channel: input.channel ?? null,
          flat: BigInt(input.flat),
          percentage: input.percentage,
          minAmount: BigInt(input.minAmount),
          maxAmount: input.maxAmount == null ? null : BigInt(input.maxAmount),
          active: input.active,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.feeRule.create',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { feeRuleId: created.id, type: created.type, channel: created.channel },
        },
      });
      return toFeeRule(created);
    });
  }

  async updateFeeRule(
    id: string,
    input: AdminFeeRuleUpdate,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminFeeRule> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.feeRule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Fee rule not found');
      const minAmount = input.minAmount ?? Number(existing.minAmount);
      const maxAmount =
        input.maxAmount === undefined
          ? existing.maxAmount == null
            ? null
            : Number(existing.maxAmount)
          : input.maxAmount;
      assertFeeRuleRange(minAmount, maxAmount);
      const updated = await tx.feeRule.update({
        where: { id },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.channel !== undefined ? { channel: input.channel } : {}),
          ...(input.flat !== undefined ? { flat: BigInt(input.flat) } : {}),
          ...(input.percentage !== undefined ? { percentage: input.percentage } : {}),
          ...(input.minAmount !== undefined ? { minAmount: BigInt(input.minAmount) } : {}),
          ...(input.maxAmount !== undefined
            ? { maxAmount: input.maxAmount == null ? null : BigInt(input.maxAmount) }
            : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.feeRule.update',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { feeRuleId: id, type: updated.type, channel: updated.channel },
        },
      });
      return toFeeRule(updated);
    });
  }

  async deleteFeeRule(
    id: string,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.feeRule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Fee rule not found');
      await tx.feeRule.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'admin.feeRule.delete',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { feeRuleId: id, type: existing.type, channel: existing.channel },
        },
      });
    });
  }

  private async recordSensitiveSearch(
    action: string,
    actorId: string,
    query: AdminSearchQuery,
    context: AdminAuditContext,
  ): Promise<void> {
    if (!query.q) return;    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: {
          page: query.page,
          pageSize: query.pageSize,
          queryLength: query.q.length,
        },
      },
    });
  }

  private async recordDetailAccess(
    action: string,
    targetId: string,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { targetId },
      },
    });
  }
}

function maskIdentifier(value: string): string {
  const visible = Math.min(4, value.length);
  return `${'*'.repeat(Math.max(0, value.length - visible))}${value.slice(-visible)}`;
}

function maskPhone(value: string | null): string | null {
  return value ? maskIdentifier(value.replace(/\s+/g, '')) : null;
}

function maskEmail(value: string | null): string | null {
  if (!value) return null;
  const [local = '', domain = ''] = value.split('@');
  if (!domain) return maskIdentifier(value);
  const visible = local.slice(-1);
  return `${'*'.repeat(Math.max(1, local.length - visible.length))}${visible}@${domain}`;
}

function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    placement: row.placement as Promotion['placement'],
    imageUrl: row.imageUrl,
    active: row.active,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFeeRule(row: FeeRuleRow): AdminFeeRule {
  return {
    id: row.id,
    type: row.type,
    channel: row.channel,
    flat: row.flat.toString(),
    percentage: row.percentage,
    minAmount: row.minAmount.toString(),
    maxAmount: row.maxAmount?.toString() ?? null,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

function assertFeeRuleRange(minAmount: number, maxAmount: number | null): void {
  if (maxAmount != null && maxAmount < minAmount) {
    throw new ConflictException(
      'The maximum amount must be greater than or equal to the minimum',
    );
  }
}
