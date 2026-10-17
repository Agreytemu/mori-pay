import { useEffect, useRef, useState } from 'react';
import type * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { getNotifications } from '@/lib/notifications';
import { useSession } from '@/lib/session';

export function TransactionNotificationObserver() {
  const router = useRouter();
  const { status } = useSession();
  const [pendingNotification, setPendingNotification] = useState<{
    transactionId: string;
    sequence: number;
  } | null>(null);
  const sequence = useRef(0);
  const routedSequence = useRef(0);

  useEffect(() => {
    const notifications = getNotifications();
    if (!notifications) return undefined;

    const clearLastResponse = () => {
      void notifications.clearLastNotificationResponseAsync().catch((error: unknown) => {
        console.warn('Could not clear the last notification response.', error);
      });
    };
    const handleResponse = (response: Notifications.NotificationResponse) => {
      clearLastResponse();
      const transactionId =
        response.notification.request.content.data?.transactionId;
      if (typeof transactionId === 'string' && transactionId.length > 0) {
        sequence.current += 1;
        setPendingNotification({
          transactionId,
          sequence: sequence.current,
        });
      }
    };

    const lastResponse = notifications.getLastNotificationResponse();
    const initialResponseTimer = lastResponse
      ? setTimeout(() => handleResponse(lastResponse), 0)
      : undefined;

    const subscription =
      notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => {
      if (initialResponseTimer) clearTimeout(initialResponseTimer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      !pendingNotification ||
      routedSequence.current === pendingNotification.sequence
    ) {
      return;
    }
    routedSequence.current = pendingNotification.sequence;
    router.push({
      pathname: '/transaction/[id]',
      params: { id: pendingNotification.transactionId },
    });
  }, [pendingNotification, router, status]);

  return null;
}
