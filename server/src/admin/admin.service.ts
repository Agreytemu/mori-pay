import {
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
} from '@mori-pay/contracts';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';

export type AdminAuditContext = { ip?: string; userAgent?: string };

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
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
          type: true,
          channel: true,
          flat: true,
          percentage: true,
          minAmount: true,
          maxAmount: true,
          active: true,
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
        type: rule.type,
        channel: rule.channel,
        flat: rule.flat.toString(),
        percentage: rule.percentage,
        minAmount: rule.minAmount.toString(),
        maxAmount: rule.maxAmount?.toString() ?? null,
        active: rule.active,
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
    const where = {
      OR: [
        { id: search },
        { phone: { startsWith: search } },
        { email: { startsWith: search, mode: 'insensitive' as const } },
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { memberId: { startsWith: search, mode: 'insensitive' as const } },
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

    return {
      items: users.map((user) => ({
        id: user.id,
        name: user.fullName,
        phone: maskPhone(user.phone),
        email: maskEmail(user.email),
        memberId: maskIdentifier(user.memberId),
        status: user.status,
        tier: user.tier,
        kycLevel: user.kycLevel,
        createdAt: user.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async searchTransactions(
    query: AdminSearchQuery,
    actorId: string,
    context: AdminAuditContext,
  ): Promise<AdminTransactionSearchPage> {
    await this.recordSensitiveSearch('admin.transaction.search', actorId, query, context);
    const search = query.q;
    const where = {
      OR: [
        { id: search },
        { reference: { startsWith: search, mode: 'insensitive' as const } },
        {
          user: {
            is: {
              OR: [
                { id: search },
                { phone: { startsWith: search } },
                { memberId: { startsWith: search, mode: 'insensitive' as const } },
              ],
            },
          },
        },
      ],
    };
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

  private async recordSensitiveSearch(
    action: string,
    actorId: string,
    query: AdminSearchQuery,
    context: AdminAuditContext,
  ): Promise<void> {
    await this.prisma.auditLog.create({
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
