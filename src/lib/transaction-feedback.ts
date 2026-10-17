import * as Haptics from 'expo-haptics';

import { storage } from '@/lib/storage';

const FEEDBACK_KEY_PREFIX = 'mori.transactionSuccessHaptic.';

let feedbackQueue: Promise<void> = Promise.resolve();
const deliveredThisSession = new Set<string>();

/**
 * Emits a best-effort success haptic once per authoritative transaction ID.
 * The durable marker prevents a second cue when a completed transaction is
 * returned again by polling or an idempotent API replay.
 */
export function triggerTransactionSuccessHaptic(transactionId: string): Promise<void> {
  const task = feedbackQueue.then(async () => {
    if (deliveredThisSession.has(transactionId)) return;

    const key = `${FEEDBACK_KEY_PREFIX}${transactionId}`;
    try {
      if (await storage.get(key)) {
        deliveredThisSession.add(transactionId);
        return;
      }
    } catch (error) {
      console.warn('Could not check transaction feedback history.', error);
    }

    deliveredThisSession.add(transactionId);
    try {
      await storage.set(key, '1');
    } catch (error) {
      console.warn('Could not save transaction feedback history.', error);
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Transaction success haptic is unavailable on this device.', error);
    }
  });
  feedbackQueue = task.catch(() => undefined);
  return task;
}

export function notifyTransactionCompleted(transactionId: string): Promise<void> {
  return triggerTransactionSuccessHaptic(transactionId);
}
