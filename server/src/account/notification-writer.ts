import type { Prisma } from '../generated/prisma/client.js';

type NotificationClient = Pick<
  Prisma.TransactionClient,
  'notification' | 'notificationPreference'
>;

type TransactionNotice = {
  id: string;
  userId: string;
  direction: string;
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

  await client.notification.create({
    data: {
      userId: transaction.userId,
      transactionId: transaction.id,
      kind: 'transaction',
      title: 'Transaction started',
      body: 'A transaction was started. Open MORI PAY to check its status.',
    },
  });
}
