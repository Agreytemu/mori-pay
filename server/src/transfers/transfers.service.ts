import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  RecipientLookup,
  SendMoneyResult,
  TransferPreview,
  SendMoneyInput,
  PreviewTransferInput,
} from '@mori-pay/contracts';

import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FeesService } from '../payments/fees.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { WalletService } from '../wallet/wallet.service.js';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
  ) {}

  async resolveRecipient(phone: string): Promise<RecipientLookup> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { phone: true, fullName: true, firstName: true },
    });

    if (!user) return { found: false, phoneNumber: phone };
    return {
      found: true,
      phoneNumber: user.phone,
      fullName: user.fullName,
      firstName: user.firstName,
    };
  }

  async preview(input: PreviewTransferInput): Promise<TransferPreview> {
    const recipient = await this.resolveRecipient(input.recipientPhone);
    if (!recipient.found) {
      throw new NotFoundException('No Mori Pay account uses that number');
    }

    const amount = BigInt(input.amount);
    const fee = await this.fees.resolveFee({
      type: 'send',
      channel: 'wallet',
      amount,
    });

    return {
      recipient: { ...recipient, found: true },
      amount: input.amount,
      fee: Number(fee),
      total: input.amount + Number(fee),
      currency: 'TZS',
    };
  }

  async send(userId: string, input: SendMoneyInput): Promise<SendMoneyResult> {
    const sender = await this.wallet.loadUserWithWallet(userId);
    if (sender.phone === input.recipientPhone) {
      throw new BadRequestException('You cannot send money to yourself');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { phone: input.recipientPhone },
      include: { wallet: { include: { ledgerAccounts: true } } },
    });
    if (!recipient) {
      throw new NotFoundException('No Mori Pay account uses that number');
    }
    if (recipient.status === 'restricted') {
      throw new BadRequestException('Recipient cannot receive money right now');
    }

    await this.auth.verifyPin(userId, input.pin);

    const amount = BigInt(input.amount);
    const fee = await this.fees.resolveFee({
      type: 'send',
      channel: 'wallet',
      amount,
    });

    const transaction = await this.payments.transferToUser({
      from: sender,
      to: recipient,
      amount,
      fee,
      note: input.note,
      type: 'send',
      category: 'person',
      idempotencyKey: input.idempotencyKey,
    });

    return { transaction, recipientName: recipient.fullName, fee: Number(fee) };
  }
}
