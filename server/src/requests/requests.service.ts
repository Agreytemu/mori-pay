import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  MoneyRequest,
  MoneyRequestDirection,
  MoneyRequestStatus,
  PayRequestInput,
  PayRequestResult,
  RequestMoneyInput,
  RequestMoneyResult,
} from '@mori-pay/contracts';

import { AuthService } from '../auth/auth.service.js';
import { generateReference } from '../common/crypto.js';
import type { MoneyRequest as MoneyRequestRow } from '../generated/prisma/client.js';
import { FeesService } from '../payments/fees.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { LimitsService } from '../limits/limits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { queueNotificationForPush } from '../account/notification-writer.js';
import { WalletService } from '../wallet/wallet.service.js';
import { toTransaction } from '../wallet/wallet.mapper.js';

const REQUEST_TTL_DAYS = 7;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
    private readonly limits: LimitsService,
  ) {}

  async create(userId: string, input: RequestMoneyInput): Promise<RequestMoneyResult> {
    const requester = await this.wallet.loadUserWithWallet(userId);
    if (requester.phone === input.payerPhone) {
      throw new BadRequestException('You cannot request money from yourself');
    }

    const payer = await this.prisma.user.findUnique({
      where: { phone: input.payerPhone },
      select: { id: true, fullName: true },
    });

    if (!payer) {
      throw new BadRequestException(
        'No Mori Pay account found for that number. Money can only be requested from registered Mori Pay users.',
      );
    }

    const amount = BigInt(input.amount);
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.moneyRequest.create({
        data: {
          requesterId: userId,
          payerPhone: input.payerPhone,
          amount,
          note: input.note ?? null,
          reference: generateReference('REQ'),
          status: 'pending',
          expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 86_400_000),
        },
      });

      const preferences = await tx.notificationPreference.findUnique({
        where: { userId: payer.id },
        select: { transactions: true },
      });
      if (preferences?.transactions ?? true) {
        const notification = await tx.notification.create({
          data: {
            userId: payer.id,
            kind: 'request',
            title: 'Money requested',
            body: `${requester.fullName} requested ${amount.toString()} TZS${input.note ? `: ${input.note}` : '.'}`,
          },
        });
        await queueNotificationForPush(tx, payer.id, notification.id);
      }

      return created;
    });

    return {
      request: this.toDto(request, 'outgoing', requester.fullName, payer.fullName),
    };
  }

  async list(userId: string): Promise<MoneyRequest[]> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true, fullName: true },
    });

    const [outgoing, incoming] = await Promise.all([
      this.prisma.moneyRequest.findMany({
        where: { requesterId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      me.phone
        ? this.prisma.moneyRequest.findMany({
            where: { payerPhone: me.phone },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const rows = [...outgoing, ...incoming].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const requesterIds = [...new Set(rows.map((row) => row.requesterId))];
    const payerPhones = [...new Set(rows.map((row) => row.payerPhone))];
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: { in: requesterIds } },
          { phone: { in: payerPhones } },
        ],
      },
      select: { id: true, phone: true, fullName: true },
    });

    const nameById = new Map(users.map((user) => [user.id, user.fullName]));
    const nameByPhone = new Map(users.map((user) => [user.phone, user.fullName]));

    return rows.map((row) =>
      this.toDto(
        row,
        row.requesterId === userId ? 'outgoing' : 'incoming',
        nameById.get(row.requesterId) ?? me.fullName,
        nameByPhone.get(row.payerPhone),
      ),
    );
  }

  async pay(
    userId: string,
    requestId: string,
    input: PayRequestInput,
  ): Promise<PayRequestResult> {
    const payer = await this.wallet.loadUserWithWallet(userId);
    const request = await this.prisma.moneyRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.payerPhone !== payer.phone) {
      throw new ForbiddenException('This request is not addressed to you');
    }

    // Idempotent replay: the same key for the same request returns the original
    // result instead of failing (or, worse, moving money again).
    if (input.idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({
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
          existing.type !== 'send' ||
          existing.direction !== 'debit' ||
          metadata?.moneyRequestId !== request.id ||
          existing.amount !== request.amount
        ) {
          throw new ConflictException(
            'This idempotency key was already used for a different transaction.',
          );
        }
        const [updated, requesterRow] = await Promise.all([
          this.prisma.moneyRequest.findUniqueOrThrow({
            where: { id: request.id },
          }),
          this.prisma.user.findUniqueOrThrow({
            where: { id: request.requesterId },
            select: { fullName: true },
          }),
        ]);
        return {
          request: this.toDto(
            updated,
            'incoming',
            requesterRow.fullName,
            payer.fullName,
          ),
          transaction: toTransaction(existing),
          fee: Number(existing.fee),
        };
      }
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('This request is no longer payable');
    }
    const now = new Date();
    if (request.expiresAt && request.expiresAt <= now) {
      await this.prisma.moneyRequest.updateMany({
        where: { id: request.id, status: 'pending' },
        data: { status: 'expired' },
      });
      throw new BadRequestException('This request has expired');
    }

    await this.auth.verifyPin(userId, input.pin);

    const requester = await this.prisma.user.findUnique({
      where: { id: request.requesterId },
      include: { wallet: { include: { ledgerAccounts: true } } },
    });
    if (!requester) throw new NotFoundException('Requester no longer exists');

    const feeDetail = await this.fees.resolveFeeDetail({
      type: 'send',
      channel: 'wallet',
      amount: request.amount,
    });

    const { transaction, updated } = await this.prisma.$transaction(
      async (client) => {
        const claimed = await client.moneyRequest.updateMany({
          where: {
            id: request.id,
            status: 'pending',
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          data: { status: 'paid' },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('This request is no longer payable');
        }

        await this.limits.assertWithinLimitsForUpdate(
          client,
          userId,
          payer.tier,
          request.amount + feeDetail.fee,
        );

        const transaction = await this.payments.transferToUser(
          {
            from: payer,
            to: requester,
            amount: request.amount,
            fee: feeDetail.fee,
            feeDetail,
            note: request.note ?? undefined,
            type: 'send',
            category: 'person',
            idempotencyKey: input.idempotencyKey,
            metadata: { moneyRequestId: request.id },
          },
          client,
        );
        const updated = await client.moneyRequest.findUniqueOrThrow({
          where: { id: request.id },
        });
        return { transaction, updated };
      },
    );

    return {
      request: this.toDto(updated, 'incoming', requester.fullName, payer.fullName),
      transaction,
      fee: Number(feeDetail.fee),
    };
  }

  async cancel(userId: string, requestId: string): Promise<void> {
    const request = await this.prisma.moneyRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.requesterId !== userId) {
      throw new ForbiddenException('You cannot cancel this request');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    const updated = await this.prisma.moneyRequest.updateMany({
      where: { id: request.id, requesterId: userId, status: 'pending' },
      data: { status: 'cancelled' },
    });
    if (updated.count !== 1) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
  }

  private metadataObject(
    value: unknown,
  ): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private toDto(
    request: MoneyRequestRow,
    direction: MoneyRequestDirection,
    requesterName: string,
    payerName?: string,
  ): MoneyRequest {
    return {
      id: request.id,
      reference: request.reference,
      amount: Number(request.amount),
      currency: 'TZS' as MoneyRequest['currency'],
      note: request.note ?? undefined,
      payerPhone: request.payerPhone,
      payerName,
      requesterName,
      status: request.status as MoneyRequestStatus,
      direction,
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt?.toISOString(),
    };
  }
}
