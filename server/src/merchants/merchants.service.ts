import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  Merchant,
  MerchantApplication as MerchantApplicationDto,
  MerchantApplicationInput,
  MerchantApplicationReviewInput,
  MerchantAccountStatusInput,
  MerchantFixedQrInput,
  MerchantPaymentPreview,
  MerchantPaymentPreviewInput,
  MerchantQrCode as MerchantQrCodeDto,
  MerchantQrPreview,
  MerchantQrPreviewInput,
  MerchantRegistrationFee,
  MerchantRegistrationPaymentInput,
  MerchantStaticQrInput,
  PayMerchantInput,
  PayMerchantQrInput,
  PayMerchantQrResult,
  PayMerchantResult,
} from '@mori-pay/contracts';

import { Prisma } from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { randomToken, sha256 } from '../common/crypto.js';
import { SYSTEM_LEDGER_ACCOUNTS } from '../ledger/ledger.service.js';
import { FeesService } from '../payments/fees.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { LimitsService } from '../limits/limits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { toTransaction } from '../wallet/wallet.mapper.js';

export type AuditContext = { ip?: string; userAgent?: string };

const CONFIG_ID = 'merchant-registration';

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
    private readonly limits: LimitsService,
  ) {}

  async list(): Promise<Merchant[]> {
    const merchants = await this.prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    return merchants.map((merchant) => ({
      id: merchant.id,
      name: merchant.name,
      identifier: merchant.identifier,
      category: merchant.category,
      phoneNumber: merchant.phone ?? undefined,
    }));
  }

  async preview(input: MerchantPaymentPreviewInput): Promise<MerchantPaymentPreview> {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        active: true,
        OR: [{ id: input.merchantId }, { identifier: input.merchantId }],
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const amount = BigInt(input.amount);
    const feeDetail = await this.fees.resolveFeeDetail({
      type: 'payment',
      channel: 'wallet',
      amount,
    });
    return {
      merchantName: merchant.name,
      amount: input.amount,
      fee: Number(feeDetail.fee),
      feePercentage: feeDetail.percentage,
      total: Number(amount + feeDetail.fee),
    };
  }

  async pay(userId: string, input: PayMerchantInput): Promise<PayMerchantResult> {
    const payer = await this.wallet.loadUserWithWallet(userId);
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        active: true,
        OR: [{ id: input.merchantId }, { identifier: input.merchantId }],
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    await this.auth.verifyPin(userId, input.pin);

    const amount = BigInt(input.amount);
    const feeDetail = await this.fees.resolveFeeDetail({
      type: 'payment',
      channel: 'wallet',
      amount,
    });
    await this.limits.assertWithinLimits(
      payer.id,
      payer.tier,
      amount + feeDetail.fee,
    );

    // Legacy seeded catalogue entries still post to the shared system merchant
    // ledger; owner onboarding and merchant QR payments use dedicated accounts.
    const transaction = await this.payments.paySystem({
      from: payer,
      system: SYSTEM_LEDGER_ACCOUNTS.merchant,
      amount,
      fee: feeDetail.fee,
      feeDetail,
      note: input.note,
      type: 'payment',
      category: 'merchant',
      counterparty: merchant.name,
      counterpartyDetail: merchant.identifier,
      idempotencyKey: input.idempotencyKey,
      metadata: { merchantId: merchant.id },
    });

    return { transaction, merchantName: merchant.name, fee: Number(feeDetail.fee) };
  }

  async registrationFee(): Promise<MerchantRegistrationFee> {
    const configuration = await this.prisma.merchantConfiguration.findUnique({
      where: { id: CONFIG_ID },
    });
    return {
      amount: configuration?.registrationFeeAmount == null
        ? null
        : Number(configuration.registrationFeeAmount),
    };
  }

  async application(userId: string): Promise<MerchantApplicationDto | null> {
    const application = await this.prisma.merchantApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return application ? this.toApplicationDto(application) : null;
  }

  async apply(
    userId: string,
    input: MerchantApplicationInput,
  ): Promise<MerchantApplicationDto> {
    try {
      const application = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.merchantApplication.findFirst({
          where: {
            userId,
            status: { in: ['pending_payment', 'awaiting_review', 'approved'] },
          },
        });
        if (existing) {
          throw new ConflictException('An active merchant application already exists');
        }
        const configuration = await tx.merchantConfiguration.findUnique({
          where: { id: CONFIG_ID },
        });
        return tx.merchantApplication.create({
          data: {
            userId,
            businessName: input.businessName,
            category: input.category,
            phone: input.phone ?? null,
            status: 'pending_payment',
            registrationFeeAmount: configuration?.registrationFeeAmount ?? null,
          },
        });
      });
      return this.toApplicationDto(application);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An active merchant application already exists');
      }
      throw error;
    }
  }

  async payRegistrationFee(
    userId: string,
    input: MerchantRegistrationPaymentInput,
  ): Promise<MerchantApplicationDto> {
    await this.auth.verifyPin(userId, input.pin);
    const payer = await this.wallet.loadUserWithWallet(userId);
    try {
      await this.prisma.$transaction(async (tx) => {
        const configuration = await tx.merchantConfiguration.findUnique({
          where: { id: CONFIG_ID },
        });
        if (configuration?.registrationFeeAmount == null) {
          throw new ConflictException('Merchant registration fee is not configured');
        }
        const application = await tx.merchantApplication.findFirst({
          where: { userId, status: 'pending_payment' },
          orderBy: { createdAt: 'desc' },
        });
        if (!application) {
          throw new ConflictException('No merchant application is awaiting payment');
        }
        if (application.registrationPaymentId) {
          throw new ConflictException('Merchant registration fee has already been paid');
        }
        const existingPayment = await tx.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existingPayment) {
          const metadata = this.metadataObject(existingPayment.metadata);
          if (
            existingPayment.category !== 'merchant_registration' ||
            metadata?.merchantApplicationId !== application.id
          ) {
            throw new ConflictException('This payment idempotency key was already used');
          }
          throw new ConflictException('Merchant registration fee has already been paid');
        }
        const feeAmount =
          application.registrationFeeAmount ?? configuration.registrationFeeAmount;
        await tx.merchantApplication.updateMany({
          where: { id: application.id, registrationFeeAmount: null },
          data: { registrationFeeAmount: feeAmount },
        });
        await this.limits.assertWithinLimits(payer.id, payer.tier, feeAmount);

        await this.payments.paySystem(
          {
            from: payer,
            system: SYSTEM_LEDGER_ACCOUNTS.fees,
            amount: feeAmount,
            fee: 0n,
            type: 'payment',
            category: 'merchant_registration',
            counterparty: 'Mori Pay',
            counterpartyDetail: application.id,
            idempotencyKey: input.idempotencyKey,
            metadata: { merchantApplicationId: application.id },
            onSettled: async (paymentTx, transactionId) => {
              const updated = await paymentTx.merchantApplication.updateMany({
                where: {
                  id: application.id,
                  userId,
                  status: 'pending_payment',
                  registrationPaymentId: null,
                },
                data: {
                  status: 'awaiting_review',
                  registrationFeeAmount: feeAmount,
                  registrationPaymentId: transactionId,
                  paidAt: new Date(),
                },
              });
              if (updated.count !== 1) {
                throw new ConflictException('Merchant application payment state changed');
              }
            },
          },
          tx,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This payment idempotency key was already used');
      }
      throw error;
    }

    const paidApplication = await this.prisma.merchantApplication.findFirstOrThrow({
      where: { userId, status: 'awaiting_review' },
      orderBy: { updatedAt: 'desc' },
    });
    return this.toApplicationDto(paidApplication);
  }

  async adminApplications(): Promise<
    Array<MerchantApplicationDto & { applicantName: string; applicantPhone?: string }>
  > {
    const applications = await this.prisma.merchantApplication.findMany({
      where: { status: { in: ['pending_payment', 'awaiting_review'] } },
      include: { user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return applications.map((application) => ({
      ...this.toApplicationDto(application),
      applicantName: application.user.fullName,
      applicantPhone: application.user.phone ?? undefined,
    }));
  }

  async setRegistrationFee(
    adminId: string,
    amount: number,
    audit: AuditContext,
  ): Promise<MerchantRegistrationFee> {
    const configuration = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.merchantConfiguration.findUnique({
        where: { id: CONFIG_ID },
        select: { registrationFeeAmount: true },
      });
      const updated = await tx.merchantConfiguration.upsert({
        where: { id: CONFIG_ID },
        create: { id: CONFIG_ID, registrationFeeAmount: BigInt(amount) },
        update: { registrationFeeAmount: BigInt(amount) },
      });
      await this.writeAudit(
        adminId,
        'merchant.registration_fee.updated',
        audit,
        {
          previousAmount: previous?.registrationFeeAmount?.toString() ?? null,
          amount: updated.registrationFeeAmount!.toString(),
        },
        tx,
      );
      return updated;
    });
    return { amount: Number(configuration.registrationFeeAmount) };
  }

  async reviewApplication(
    adminId: string,
    applicationId: string,
    input: MerchantApplicationReviewInput,
    audit: AuditContext,
  ): Promise<MerchantApplicationDto> {
    const application = await this.prisma.$transaction(async (tx) => {
      const current = await tx.merchantApplication.findUnique({
        where: { id: applicationId },
      });
      if (!current) throw new NotFoundException('Merchant application not found');
      if (current.status !== 'awaiting_review' || !current.paidAt) {
        throw new ConflictException('Only paid applications can be reviewed');
      }

      if (input.decision === 'rejected') {
        const rejected = await tx.merchantApplication.update({
          where: { id: applicationId },
          data: {
            status: 'rejected',
            reviewedById: adminId,
            reviewedAt: new Date(),
            reviewNote: input.reviewNote ?? null,
          },
        });
        await this.writeAudit(
          adminId,
          'merchant.application.reviewed',
          audit,
          {
            applicationId,
            decision: input.decision,
            note: input.reviewNote ?? null,
          },
          tx,
        );
        return rejected;
      }

      const existing = await tx.merchantAccount.findUnique({
        where: { applicationId },
      });
      if (existing) throw new ConflictException('Application already has a merchant account');
      const accountLedger = await tx.ledgerAccount.create({
        data: { walletId: null, kind: 'merchant_account', currency: 'TZS', balance: 0n },
      });
      await tx.merchantAccount.create({
        data: {
          applicationId,
          ownerId: current.userId,
          name: current.businessName,
          identifier: `m-${randomToken(12)}`,
          category: current.category,
          phone: current.phone,
          ledgerAccountId: accountLedger.id,
        },
      });
      const approved = await tx.merchantApplication.update({
        where: { id: applicationId },
        data: {
          status: 'approved',
          reviewedById: adminId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
        },
      });
      await this.writeAudit(
        adminId,
        'merchant.application.reviewed',
        audit,
        {
          applicationId,
          decision: input.decision,
          note: input.reviewNote ?? null,
        },
        tx,
      );
      return approved;
    });
    return this.toApplicationDto(application);
  }

  async setAccountStatus(
    adminId: string,
    accountId: string,
    input: MerchantAccountStatusInput,
    audit: AuditContext,
  ): Promise<{ id: string; status: string }> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const account = await tx.merchantAccount.findUnique({
        where: { id: accountId },
        select: { id: true, status: true },
      });
      if (!account) throw new NotFoundException('Merchant account not found');
      const result = await tx.merchantAccount.update({
        where: { id: accountId },
        data: { status: input.status },
        select: { id: true, status: true },
      });
      await this.writeAudit(
        adminId,
        'merchant.account.status_updated',
        audit,
        {
          accountId,
          previousStatus: account.status,
          status: result.status,
        },
        tx,
      );
      return result;
    });
    return updated;
  }

  async createStaticQr(
    userId: string,
    input: MerchantStaticQrInput,
  ): Promise<MerchantQrCodeDto> {
    const merchant = await this.ownedActiveMerchant(userId);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('QR expiry must be in the future');
    }
    return this.createQr(merchant.id, 'static', null, true, expiresAt);
  }

  async createFixedQr(
    userId: string,
    input: MerchantFixedQrInput,
  ): Promise<MerchantQrCodeDto> {
    const merchant = await this.ownedActiveMerchant(userId);
    const expiresAt = new Date(input.expiresAt);
    if (expiresAt <= new Date()) {
      throw new BadRequestException('QR expiry must be in the future');
    }
    return this.createQr(
      merchant.id,
      'fixed',
      BigInt(input.amount),
      input.reusable,
      expiresAt,
    );
  }

  async revokeQr(userId: string, codeId: string): Promise<void> {
    const result = await this.prisma.merchantQrCode.updateMany({
      where: {
        id: codeId,
        revokedAt: null,
        merchantAccount: { is: { ownerId: userId } },
      },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('Merchant QR code not found');
  }

  async previewQr(
    userId: string,
    input: MerchantQrPreviewInput,
  ): Promise<MerchantQrPreview> {
    const resolved = await this.resolveQr(input.code);
    this.assertQrAvailable(resolved);
    if (resolved.merchantAccount.ownerId === userId) {
      throw new BadRequestException('A merchant cannot pay its own QR code');
    }
    const amount = this.resolveAmount(resolved, input.amount);
    return {
      merchantName: resolved.merchantAccount.name,
      amount: Number(amount),
      fee: 0,
      total: Number(amount),
    };
  }

  async payQr(userId: string, input: PayMerchantQrInput): Promise<PayMerchantQrResult> {
    const payer = await this.wallet.loadUserWithWallet(userId);
    await this.auth.verifyPin(userId, input.pin);
    const qr = await this.resolveQr(input.code);
    if (qr.merchantAccount.ownerId === userId) {
      throw new BadRequestException('A merchant cannot pay its own QR code');
    }
    const amount = this.resolveAmount(qr, input.amount);
    await this.limits.assertWithinLimits(payer.id, payer.tier, amount);

    try {
      const transaction = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          const metadata = this.metadataObject(existing.metadata);
          if (
            existing.category !== 'merchant_qr' ||
            metadata?.merchantQrCodeId !== qr.id
          ) {
            throw new ConflictException('This payment idempotency key was already used');
          }
          return toTransaction(existing);
        }

        this.assertQrAvailable(qr);
        const now = new Date();
        const claimed = await tx.merchantQrCode.updateMany({
          where: {
            id: qr.id,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            merchantAccount: { is: { status: 'active' } },
            ...(qr.kind === 'fixed' && !qr.reusable ? { uses: 0 } : {}),
          },
          data: { uses: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          throw new ConflictException('Merchant QR code is expired, revoked, or already used');
        }

        return this.payments.paySystem(
          {
            from: payer,
            system: SYSTEM_LEDGER_ACCOUNTS.merchant,
            destinationLedgerAccountId: qr.merchantAccount.ledgerAccountId,
            amount,
            fee: 0n,
            type: 'payment',
            category: 'merchant_qr',
            counterparty: qr.merchantAccount.name,
            counterpartyDetail: qr.merchantAccount.identifier,
            idempotencyKey: input.idempotencyKey,
            metadata: {
              merchantAccountId: qr.merchantAccount.id,
              merchantQrCodeId: qr.id,
            },
          },
          tx,
        );
      });
      return { transaction, merchantName: qr.merchantAccount.name, fee: 0 };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        const metadata = this.metadataObject(existing?.metadata);
        if (existing?.category === 'merchant_qr' && metadata?.merchantQrCodeId === qr.id) {
          return {
            transaction: toTransaction(existing),
            merchantName: qr.merchantAccount.name,
            fee: 0,
          };
        }
        throw new ConflictException('This payment idempotency key was already used');
      }
      throw error;
    }
  }

  private async ownedActiveMerchant(userId: string) {
    const merchant = await this.prisma.merchantAccount.findFirst({
      where: { ownerId: userId, status: 'active' },
      include: { ledgerAccount: true },
    });
    if (!merchant) throw new NotFoundException('No active merchant account is available');
    return merchant;
  }

  private async createQr(
    merchantAccountId: string,
    kind: 'static' | 'fixed',
    fixedAmount: bigint | null,
    reusable: boolean,
    expiresAt: Date | null,
  ): Promise<MerchantQrCodeDto> {
    const code = randomToken(32);
    const qr = await this.prisma.merchantQrCode.create({
      data: {
        merchantAccountId,
        codeHash: sha256(code),
        kind,
        fixedAmount,
        reusable,
        expiresAt,
      },
    });
    return {
      id: qr.id,
      code,
      kind: qr.kind,
      amount: qr.fixedAmount == null ? undefined : Number(qr.fixedAmount),
      reusable: qr.reusable,
      expiresAt: qr.expiresAt?.toISOString(),
    };
  }

  private async resolveQr(code: string) {
    const qr = await this.prisma.merchantQrCode.findUnique({
      where: { codeHash: sha256(code) },
      include: { merchantAccount: { include: { ledgerAccount: true } } },
    });
    if (!qr) throw new NotFoundException('Merchant QR code not found');
    return qr;
  }

  private assertQrAvailable(qr: {
    kind: 'static' | 'fixed';
    fixedAmount: bigint | null;
    reusable: boolean;
    uses: number;
    expiresAt: Date | null;
    revokedAt: Date | null;
    merchantAccount: { status: 'active' | 'suspended' | 'revoked' };
  }): void {
    if (
      qr.revokedAt ||
      (qr.expiresAt && qr.expiresAt <= new Date()) ||
      (qr.kind === 'fixed' && !qr.reusable && qr.uses > 0) ||
      qr.merchantAccount.status !== 'active'
    ) {
      throw new ConflictException('Merchant QR code is not available');
    }
  }

  private resolveAmount(
    qr: { kind: 'static' | 'fixed'; fixedAmount: bigint | null },
    requestedAmount?: number,
  ): bigint {
    if (qr.kind === 'fixed') {
      if (qr.fixedAmount == null) throw new ConflictException('Fixed QR amount is missing');
      if (requestedAmount != null && BigInt(requestedAmount) !== qr.fixedAmount) {
        throw new BadRequestException('Amount does not match the fixed QR amount');
      }
      return qr.fixedAmount;
    }
    if (requestedAmount == null) {
      throw new BadRequestException('An amount is required for a static merchant QR');
    }
    return BigInt(requestedAmount);
  }

  private metadataObject(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, Prisma.JsonValue> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, Prisma.JsonValue>)
      : null;
  }

  private toApplicationDto(application: {
    id: string;
    businessName: string;
    category: string;
    phone: string | null;
    status: string;
    registrationFeeAmount: bigint | null;
    paidAt: Date | null;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewNote: string | null;
  }): MerchantApplicationDto {
    return {
      id: application.id,
      businessName: application.businessName,
      category: application.category,
      phone: application.phone ?? undefined,
      status: application.status as MerchantApplicationDto['status'],
      registrationFeeAmount:
        application.registrationFeeAmount == null
          ? undefined
          : Number(application.registrationFeeAmount),
      paidAt: application.paidAt?.toISOString(),
      createdAt: application.createdAt.toISOString(),
      reviewedAt: application.reviewedAt?.toISOString(),
      reviewNote: application.reviewNote ?? undefined,
    };
  }

  private async writeAudit(
    userId: string,
    action: string,
    context: AuditContext,
    metadata: Prisma.InputJsonValue,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        userId,
        action,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata,
      },
    });
  }
}
