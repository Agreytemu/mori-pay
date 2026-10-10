import {
  BadRequestException,
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
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';

const REQUEST_TTL_DAYS = 7;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
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

      if (payer) {
        const preferences = await tx.notificationPreference.findUnique({
          where: { userId: payer.id },
          select: { transactions: true },
        });
        if (preferences?.transactions ?? true) {
          await tx.notification.create({
            data: {
              userId: payer.id,
              kind: 'request',
              title: 'Money requested',
              body: `${requester.fullName} requested ${amount.toString()} TZS${input.note ? `: ${input.note}` : '.'}`,
            },
          });
        }
      }

      return created;
    });

    return {
      request: this.toDto(request, 'outgoing', requester.fullName, payer?.fullName),
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
      this.prisma.moneyRequest.findMany({
        where: { payerPhone: me.phone },
        orderBy: { createdAt: 'desc' },
      }),
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
    if (request.status !== 'pending') {
      throw new BadRequestException('This request is no longer payable');
    }
    if (request.expiresAt && request.expiresAt < new Date()) {
      await this.prisma.moneyRequest.update({
        where: { id: request.id },
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

    const fee = await this.fees.resolveFee({
      type: 'send',
      channel: 'wallet',
      amount: request.amount,
    });

    const transaction = await this.payments.transferToUser({
      from: payer,
      to: requester,
      amount: request.amount,
      fee,
      note: request.note ?? undefined,
      type: 'send',
      category: 'person',
      idempotencyKey: input.idempotencyKey,
    });

    const updated = await this.prisma.moneyRequest.update({
      where: { id: request.id },
      data: { status: 'paid' },
    });

    return {
      request: this.toDto(updated, 'incoming', requester.fullName, payer.fullName),
      transaction,
      fee: Number(fee),
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

    await this.prisma.moneyRequest.update({
      where: { id: request.id },
      data: { status: 'cancelled' },
    });
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
