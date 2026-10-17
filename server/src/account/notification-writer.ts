import type { Prisma } from '../generated/prisma/client.js';

type NotificationClient = Pick<
  Prisma.TransactionClient,
  | 'device'
  | 'notification'
  | 'notificationDelivery'
  | 'notificationPreference'
>;

type TransactionNotice = {
  id: string;
  userId: string;
  direction: string;
  status: string;
};

export async function createTransactionNotification(
  client: NotificationClient,
  transaction: TransactionNotice,
): Promise<void> {
  if (transaction.direction !== 'credit' && transaction.direction !== 'debit') {
    throw new Error(`Unsupported transaction direction: ${transaction.direction}`);
  }

  const preferences = await client.notificationPreference.findUnique({
    where: { userId: transaction.userId },
    select: { transactions: true, moneyIn: true, moneyOut: true },
  });

  const moneyPreference = transaction.direction === 'credit'
    ? preferences?.moneyIn ?? true
    : preferences?.moneyOut ?? true;
  if (!(preferences?.transactions ?? true) && !moneyPreference) return;

  const notification = await client.notification.create({
    data: {
      userId: transaction.userId,
      transactionId: transaction.id,
      kind: 'transaction',
      title: 'Transaction started',
      body: 'A transaction was started. Open MORI PAY to check its status.',
    },
  });

  if (['completed', 'failed', 'cancelled'].includes(transaction.status)) {
    await queueNotificationForPush(
      client,
      transaction.userId,
      notification.id,
    );
  }
}

export async function queueTransactionNotificationForPush(
  client: NotificationClient,
  transactionId: string,
): Promise<void> {
  const notifications = await client.notification.findMany({
    where: { transactionId },
    select: { id: true, userId: true },
  });
  for (const notification of notifications) {
    await queueNotificationForPush(
      client,
      notification.userId,
      notification.id,
    );
  }
}

export async function queueNotificationForPush(
  client: NotificationClient,
  userId: string,
  notificationId: string,
): Promise<void> {
  const notification = await client.notification.findFirst({
    where: { id: notificationId, userId },
    select: {
      id: true,
      kind: true,
      transaction: { select: { direction: true, status: true } },
    },
  });
  if (!notification) return;

  if (
    notification.transaction &&
    !['completed', 'failed', 'cancelled'].includes(
      notification.transaction.status,
    )
  ) {
    return;
  }

  const [preferences, devices] = await Promise.all([
    client.notificationPreference.findUnique({
      where: { userId },
      select: {
        transactions: true,
        moneyIn: true,
        moneyOut: true,
        marketing: true,
        securityAlerts: true,
      },
    }),
    client.device.findMany({
      where: { userId, pushToken: { not: null } },
      select: { id: true },
    }),
  ]);

  const enabled = notification.kind === 'security'
    ? preferences?.securityAlerts ?? true
    : notification.kind === 'promotion'
      ? preferences?.marketing ?? false
      : notification.transaction
        ? (preferences?.transactions ?? true) ||
          (notification.transaction.direction === 'credit'
            ? preferences?.moneyIn ?? true
            : preferences?.moneyOut ?? true)
        : preferences?.transactions ?? true;
  if (!enabled || devices.length === 0) return;

  await client.notificationDelivery.createMany({
    data: devices.map((device) => ({
      notificationId,
      deviceId: device.id,
    })),
    skipDuplicates: true,
  });
}
