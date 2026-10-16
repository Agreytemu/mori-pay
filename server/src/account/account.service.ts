import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  AccountProfile,
  AppNotification,
  NotificationKind,
  NotificationPreference,
  SavedPaymentMethod,
  SavePaymentMethodInput,
  TrustedDevice,
  UpdateAccountProfileInput,
  UpdateNotificationPreferencesInput,
} from '@mori-pay/contracts';

import type { SavedPaymentMethod as SavedPaymentMethodRow } from '../generated/prisma/client.js';
import { encryptPaymentMethodPhone } from '../common/payment-method-crypto.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async getProfile(userId: string): Promise<AccountProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.toProfile(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateAccountProfileInput,
  ): Promise<AccountProfile> {
    const fullName = input.fullName.trim().replace(/\s+/g, ' ');
    const [firstName] = fullName.split(' ');
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    if (input.email !== current.email) {
      throw new BadRequestException(
        'Sign-in email changes must be verified before they can be saved',
      );
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        firstName,
        dateOfBirth: input.dateOfBirth
          ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
          : null,
      },
    });
    return this.toProfile(user);
  }

  async listDevices(userId: string): Promise<TrustedDevice[]> {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      platform: this.toDevicePlatform(device.platform),
      location: device.location ?? 'Location unavailable',
      lastActiveAt: device.lastActiveAt.toISOString(),
      isCurrent: device.isCurrent,
    }));
  }

  async removeDevice(userId: string, id: string): Promise<void> {
    const device = await this.prisma.device.findFirst({
      where: { id, userId },
      select: { id: true, isCurrent: true },
    });
    if (!device) throw new NotFoundException('Device not found');
    if (device.isCurrent) {
      throw new BadRequestException('Sign out before removing this device');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { deviceId: id, userId } });
      await tx.device.delete({ where: { id } });
    });
  }

  async listPaymentMethods(userId: string): Promise<SavedPaymentMethod[]> {
    const methods = await this.prisma.savedPaymentMethod.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return methods.map((method) => this.toPaymentMethod(method));
  }

  async savePaymentMethod(
    userId: string,
    input: SavePaymentMethodInput,
  ): Promise<SavedPaymentMethod> {
    const encryptedPhoneNumber = this.encryptPhoneNumber(input);
    const count = await this.prisma.savedPaymentMethod.count({
      where: { userId },
    });
    const isDefault = input.isDefault ?? count === 0;

    const method = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.savedPaymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      return tx.savedPaymentMethod.create({
        data: {
          userId,
          kind: input.kind,
          provider: input.provider,
          identifier: input.lastFour,
          encryptedPhoneNumber,
          isDefault,
        },
      });
    });
    return this.toPaymentMethod(method);
  }

  async updatePaymentMethod(
    userId: string,
    id: string,
    input: SavePaymentMethodInput,
  ): Promise<SavedPaymentMethod> {
    const existing = await this.prisma.savedPaymentMethod.findFirst({
      where: { id, userId },
      select: { id: true, identifier: true },
    });
    if (!existing) throw new NotFoundException('Payment method not found');
    if (
      input.kind === 'mobile-money' &&
      !input.phoneNumber &&
      existing.identifier.replace(/\D/g, '').slice(-4) !== input.lastFour
    ) {
      throw new BadRequestException(
        'Enter the full phone number when changing a saved mobile-money method.',
      );
    }
    const encryptedPhoneNumber = this.encryptPhoneNumber(input, false);

    const method = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.savedPaymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      return tx.savedPaymentMethod.update({
        where: { id },
        data: {
          kind: input.kind,
          provider: input.provider,
          identifier: input.lastFour,
          ...(input.kind === 'mobile-money'
            ? encryptedPhoneNumber
              ? { encryptedPhoneNumber }
              : {}
            : { encryptedPhoneNumber: null }),
          ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
        },
      });
    });
    return this.toPaymentMethod(method);
  }

  async removePaymentMethod(userId: string, id: string): Promise<void> {
    const method = await this.prisma.savedPaymentMethod.findFirst({
      where: { id, userId },
      select: { id: true, isDefault: true },
    });
    if (!method) throw new NotFoundException('Payment method not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.delete({ where: { id } });
      if (method.isDefault) {
        const next = await tx.savedPaymentMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (next) {
          await tx.savedPaymentMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  async listNotifications(userId: string): Promise<AppNotification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      include: { transaction: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return notifications.map((notification) => {
      const transaction = notification.transaction;
      const transactionCopy = !transaction
        ? null
        : transaction.status === 'completed'
          ? { title: 'Transaction completed', body: 'Transaction completed — open MORI PAY to view details.' }
          : transaction.status === 'failed'
            ? { title: 'Transaction not completed', body: 'This transaction was not completed. Open MORI PAY to view details.' }
            : transaction.status === 'cancelled'
              ? { title: 'Transaction cancelled', body: 'This transaction was cancelled. Open MORI PAY to view details.' }
              : transaction.status === 'pending' || transaction.status === 'processing'
                ? { title: 'Transaction processing', body: 'Your transaction is being processed. Open MORI PAY to check its status.' }
                : { title: 'Transaction status update', body: 'Open MORI PAY to check your transaction status.' };

      return {
        id: notification.id,
        kind: this.toNotificationKind(notification.kind),
        title: transactionCopy?.title ?? notification.title,
        body: transactionCopy?.body ?? notification.body,
        createdAt: (transaction?.settledAt ?? notification.createdAt).toISOString(),
        read: notification.read,
        ...(notification.transactionId
          ? { transactionId: notification.transactionId }
          : {}),
        ...(transaction
          ? {
              transaction: {
                status: transaction.status,
                direction: this.toTransactionDirection(transaction.direction),
                amount: Number(transaction.amount),
                reference: transaction.reference,
                counterparty: transaction.counterparty,
              },
            }
          : {}),
      };
    });
  }

  async markNotificationRead(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    if (result.count === 0) throw new NotFoundException('Notification not found');
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteNotification(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) throw new NotFoundException('Notification not found');
  }

  async clearNotifications(userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({ where: { userId } });
  }

  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreference> {
    const preferences = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return {
      transactions: preferences.transactions,
      moneyIn: preferences.moneyIn,
      moneyOut: preferences.moneyOut,
      marketing: preferences.marketing,
      securityAlerts: preferences.securityAlerts,
    };
  }

  async updateNotificationPreferences(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreference> {
    const preferences = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return {
      transactions: preferences.transactions,
      moneyIn: preferences.moneyIn,
      moneyOut: preferences.moneyOut,
      marketing: preferences.marketing,
      securityAlerts: preferences.securityAlerts,
    };
  }

  private toProfile(user: {
    id: string;
    memberId: string;
    fullName: string;
    firstName: string;
    phone: string | null;
    email: string | null;
    dateOfBirth: Date | null;
    tier: AccountProfile['tier'];
    kycLevel: number;
    status: AccountProfile['status'];
    createdAt: Date;
    pinUpdatedAt: Date | null;
  }): AccountProfile {
    return {
      id: user.id,
      memberId: user.memberId,
      fullName: user.fullName,
      firstName: user.firstName,
      phoneNumber: user.phone,
      email: user.email,
      dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      tier: user.tier,
      kycLevel: user.kycLevel,
      status: user.status,
      memberSince: user.createdAt.toISOString(),
      pinUpdatedAt: user.pinUpdatedAt?.toISOString() ?? null,
    };
  }

  private toDevicePlatform(value: string): TrustedDevice['platform'] {
    if (value === 'android' || value === 'ios' || value === 'web') return value;
    throw new BadRequestException(`Unsupported device platform: ${value}`);
  }

  private toPaymentMethod(
    method: SavedPaymentMethodRow,
  ): SavedPaymentMethod {
    return {
      id: method.id,
      kind: this.toPaymentMethodKind(method.kind),
      provider: method.provider,
      lastFour: method.identifier.replace(/\D/g, '').slice(-4),
      usableForDeposit: method.kind === 'mobile-money' && Boolean(method.encryptedPhoneNumber),
      isDefault: method.isDefault,
      status: method.status,
      createdAt: method.createdAt.toISOString(),
    };
  }

  private encryptPhoneNumber(
    input: SavePaymentMethodInput,
    required = true,
  ): string | null {
    if (input.kind !== 'mobile-money') {
      if (input.phoneNumber) {
        throw new BadRequestException(
          'A phone number can only be attached to a mobile-money method.',
        );
      }
      return null;
    }
    if (!input.phoneNumber) {
      if (required) {
        throw new BadRequestException(
          'Enter the full phone number to save a usable mobile-money method.',
        );
      }
      return null;
    }
    if (input.phoneNumber.slice(-4) !== input.lastFour) {
      throw new BadRequestException(
        'The phone number does not match its last four digits.',
      );
    }
    try {
      return encryptPaymentMethodPhone(
        input.phoneNumber,
        this.config.paymentMethodEncryptionKey,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('not configured')) {
        throw new BadRequestException(
          'Saving mobile-money methods is not configured on this server.',
        );
      }
      throw error;
    }
  }

  private toPaymentMethodKind(
    kind: string,
  ): SavedPaymentMethod['kind'] {
    if (kind === 'mobile-money' || kind === 'bank' || kind === 'card') return kind;
    throw new BadRequestException(`Unsupported payment method kind: ${kind}`);
  }

  private toNotificationKind(kind: string): NotificationKind {
    if (
      kind === 'transaction' ||
      kind === 'request' ||
      kind === 'security' ||
      kind === 'promotion'
    ) {
      return kind;
    }
    throw new BadRequestException(`Unsupported notification kind: ${kind}`);
  }

  private toTransactionDirection(value: string): 'credit' | 'debit' {
    if (value === 'credit' || value === 'debit') return value;
    throw new BadRequestException(`Unsupported transaction direction: ${value}`);
  }
}
