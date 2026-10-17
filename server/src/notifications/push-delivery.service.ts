import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

import type { NotificationDelivery } from '../generated/prisma/client.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;
const POLL_INTERVAL_MS = 5_000;
const STALE_LOCK_MS = 2 * 60_000;
const MAX_NOTIFICATION_AGE_MS = 7 * 24 * 60 * 60_000;

type DeliveryContext = NotificationDelivery & {
  device: {
    id: string;
    userId: string;
    pushToken: string | null;
    clientApp: string;
  };
  notification: {
    id: string;
    userId: string;
    kind: string;
    transactionId: string | null;
    createdAt: Date;
    transaction: { direction: string; status: string } | null;
  };
};

@Injectable()
export class PushDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushDeliveryService.name);
  private messaging: Messaging | null = null;
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    const fcm = this.config.fcm;
    if (!fcm.enabled) {
      this.logger.log('Firebase Cloud Messaging is disabled.');
      return;
    }
    if (!fcm.projectId || !fcm.clientEmail || !fcm.privateKey) {
      throw new Error(
        'FCM is enabled but Firebase service-account configuration is incomplete.',
      );
    }

    const existing = getApps().find((app) => app.name === 'mori-pay-fcm');
    const app = existing ?? initializeApp(
      {
        credential: cert({
          projectId: fcm.projectId!,
          clientEmail: fcm.clientEmail,
          privateKey: fcm.privateKey,
        }),
        projectId: fcm.projectId,
      },
      'mori-pay-fcm',
    );
    this.messaging = getMessaging(app);
    this.timer = setInterval(() => {
      void this.processPending().catch((error: unknown) => {
        this.logger.error(
          `Push delivery polling failed: ${this.errorCode(error)}`,
        );
      });
    }, POLL_INTERVAL_MS);
    this.timer.unref();
    this.logger.log('Firebase Cloud Messaging initialized.');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async processPending(): Promise<void> {
    if (!this.messaging || this.processing) return;
    this.processing = true;
    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
      const pending = await this.prisma.notificationDelivery.findMany({
        where: {
          OR: [
            { status: 'pending', nextAttemptAt: { lte: now } },
            { status: 'processing', lockedAt: { lt: staleBefore } },
          ],
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: BATCH_SIZE,
        select: { id: true },
      });

      for (const { id } of pending) {
        await this.deliver(id, now, staleBefore);
      }
    } finally {
      this.processing = false;
    }
  }

  private async deliver(
    id: string,
    now: Date,
    staleBefore: Date,
  ): Promise<void> {
    const claim = await this.prisma.notificationDelivery.updateMany({
      where: {
        id,
        OR: [
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'processing', lockedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: 'processing',
        lockedAt: now,
        attempts: { increment: 1 },
      },
    });
    if (claim.count === 0) return;

    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id },
      include: {
        device: {
          select: { id: true, userId: true, pushToken: true, clientApp: true },
        },
        notification: {
          select: {
            id: true,
            userId: true,
            kind: true,
            transactionId: true,
            createdAt: true,
            transaction: { select: { direction: true, status: true } },
          },
        },
      },
    });

    if (!delivery) return;
    if (
      !delivery.device.pushToken ||
      delivery.device.userId !== delivery.notification.userId
    ) {
      await this.finish(delivery.id, 'failed', 'device_unavailable');
      return;
    }
    if (Date.now() - delivery.notification.createdAt.getTime() > MAX_NOTIFICATION_AGE_MS) {
      await this.finish(delivery.id, 'failed', 'notification_expired');
      return;
    }
    if (
      delivery.notification.transaction &&
      !['completed', 'failed', 'cancelled'].includes(
        delivery.notification.transaction.status,
      )
    ) {
      await this.finish(delivery.id, 'failed', 'transaction_not_final');
      return;
    }
    if (!(await this.preferenceAllowsDelivery(delivery))) {
      await this.finish(delivery.id, 'failed', 'preference_disabled');
      return;
    }

    try {
      const webLink = this.webClickUrl(delivery);
      await this.messaging!.send({
        token: delivery.device.pushToken,
        notification: this.displayCopy(delivery.notification.kind),
        ...(webLink
          ? { webpush: { fcmOptions: { link: webLink } } }
          : {}),
        data: {
          notificationId: delivery.notification.id,
          kind: delivery.notification.kind,
          ...(delivery.notification.transactionId
            ? { transactionId: delivery.notification.transactionId }
            : {}),
        },
      });
    } catch (error) {
      await this.handleSendFailure(delivery, error);
      return;
    }

    await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
  }

  private async handleSendFailure(
    delivery: DeliveryContext,
    error: unknown,
  ): Promise<void> {
    const code = this.errorCode(error);
    if (
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/registration-token-not-registered'
    ) {
      await this.prisma.$transaction(async (tx) => {
        await tx.device.updateMany({
          where: {
            id: delivery.device.id,
            pushToken: delivery.device.pushToken,
          },
          data: { pushToken: null },
        });
        await tx.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            lockedAt: null,
            lastError: code,
          },
        });
      });
      this.logger.warn(`Removed invalid push token for device ${delivery.device.id}.`);
      return;
    }

    if (delivery.attempts >= MAX_ATTEMPTS) {
      await this.finish(delivery.id, 'failed', code);
      this.logger.warn(`Push delivery ${delivery.id} exhausted its retries (${code}).`);
      return;
    }

    const delaySeconds = Math.min(60 * 2 ** (delivery.attempts - 1), 3_600);
    await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'pending',
        lockedAt: null,
        lastError: code,
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1_000),
      },
    });
    this.logger.warn(`Push delivery ${delivery.id} will retry (${code}).`);
  }

  private async preferenceAllowsDelivery(
    delivery: DeliveryContext,
  ): Promise<boolean> {
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId: delivery.notification.userId },
      select: {
        transactions: true,
        moneyIn: true,
        moneyOut: true,
        marketing: true,
        securityAlerts: true,
      },
    });
    if (delivery.notification.kind === 'security') {
      return preferences?.securityAlerts ?? true;
    }
    if (delivery.notification.kind === 'promotion') {
      return preferences?.marketing ?? false;
    }
    if (delivery.notification.transaction) {
      return (preferences?.transactions ?? true) ||
        (delivery.notification.transaction.direction === 'credit'
          ? preferences?.moneyIn ?? true
          : preferences?.moneyOut ?? true);
    }
    return preferences?.transactions ?? true;
  }

  private displayCopy(kind: string): { title: string; body: string } {
    switch (kind) {
      case 'transaction':
        return {
          title: 'Mori Pay transaction update',
          body: 'Open Mori Pay to review your transaction status.',
        };
      case 'request':
        return {
          title: 'Mori Pay account update',
          body: 'Open Mori Pay to review an account update.',
        };
      case 'security':
        return {
          title: 'Mori Pay security alert',
          body: 'Open Mori Pay to review an account security update.',
        };
      case 'promotion':
        return {
          title: 'Mori Pay update',
          body: 'Open Mori Pay to view the latest update.',
        };
      default:
        return {
          title: 'Mori Pay update',
          body: 'Open Mori Pay to review your account.',
        };
    }
  }

  private webClickUrl(delivery: DeliveryContext): string | undefined {
    const baseUrl = delivery.device.clientApp === 'admin-web'
      ? this.config.fcm.adminWebUrl
      : delivery.device.clientApp === 'merchant-web'
        ? this.config.fcm.merchantWebUrl
        : undefined;
    if (!baseUrl || !baseUrl.startsWith('https://')) return undefined;

    const target = new URL('/', baseUrl);
    target.searchParams.set('notificationId', delivery.notification.id);
    if (delivery.notification.transactionId) {
      target.searchParams.set('transactionId', delivery.notification.transactionId);
      target.searchParams.set('tab', 'transactions');
    }
    return target.toString();
  }

  private async finish(
    id: string,
    status: 'failed',
    errorCode: string,
  ): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status, lockedAt: null, lastError: errorCode },
    });
  }

  private errorCode(error: unknown): string {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      return error.code.slice(0, 120);
    }
    return 'unknown_fcm_error';
  }
}
