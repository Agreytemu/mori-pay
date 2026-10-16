import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { storage } from '@/lib/storage';
import { feedback } from '@/theme/palette';

export const TRANSACTION_NOTIFICATION_CHANNEL_ID = 'transaction-updates';
const PERMISSION_REQUESTED_KEY = 'mori.transactionNotificationPermissionRequested';
const DELIVERED_KEY_PREFIX = 'mori.transactionCompletionNotification.';

let notificationQueue: Promise<void> = Promise.resolve();
const deliveredThisSession = new Set<string>();

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function canPresentTransactionNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      TRANSACTION_NOTIFICATION_CHANNEL_ID,
      {
        name: 'Transaction updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150, 100, 150],
        lightColor: feedback.cyan,
      },
    );
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status === 'granted') return true;

  if (await storage.get(PERMISSION_REQUESTED_KEY)) return false;
  await storage.set(PERMISSION_REQUESTED_KEY, '1');
  permission = await Notifications.requestPermissionsAsync();
  return permission.status === 'granted';
}

export function notifyTransactionCompletedLocally(transactionId: string): Promise<void> {
  const task = notificationQueue.then(async () => {
    if (deliveredThisSession.has(transactionId)) return;

    const key = `${DELIVERED_KEY_PREFIX}${transactionId}`;
    try {
      if (await storage.get(key)) {
        deliveredThisSession.add(transactionId);
        return;
      }
    } catch (error) {
      console.warn('Could not check local transaction notification history.', error);
    }

    try {
      if (!(await canPresentTransactionNotification())) return;
    } catch (error) {
      console.warn('Could not request transaction notification permission.', error);
      return;
    }

    deliveredThisSession.add(transactionId);
    try {
      await storage.set(key, '1');
    } catch (error) {
      console.warn('Could not save local transaction notification history.', error);
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Transaction completed',
          body: 'Transaction completed — open MORI PAY to view details.',
          data: { transactionId },
          sound: false,
          ...(Platform.OS === 'android'
            ? { channelId: TRANSACTION_NOTIFICATION_CHANNEL_ID }
            : {}),
        },
        trigger: null,
      });
    } catch (error) {
      console.warn('Could not present the local transaction notification.', error);
    }
  });
  notificationQueue = task.catch(() => undefined);
  return task;
}
