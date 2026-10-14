import { useEffect, useSyncExternalStore } from 'react';

import type { AppNotification as ApiNotification } from '@mori-pay/contracts';
import type { AppNotification } from '@/data/mock-notifications';
import {
  clearNotifications as clearApiNotifications,
  deleteNotification as deleteApiNotification,
  listNotifications,
  markAllNotificationsRead as markAllApiNotificationsRead,
  markNotificationRead as markApiNotificationRead,
} from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { formatRelativeTime } from '@/utils/format';

type StoreState = {
  userId: string | null;
  notifications: AppNotification[];
  loading: boolean;
  error: Error | null;
};

let state: StoreState = { userId: null, notifications: [], loading: false, error: null };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: StoreState) {
  state = next;
  notify();
}

function toNotification(item: ApiNotification): AppNotification {
  const transaction = item.transaction;
  const kind = item.kind === 'security'
    ? 'security'
    : item.kind === 'promotion'
      ? 'account'
      : item.kind === 'request'
        ? 'account'
        : transaction?.status === 'failed' || transaction?.status === 'cancelled'
          ? 'payment'
          : 'transaction';
  const status = item.kind === 'security'
    ? 'warning'
    : transaction?.status === 'failed' || transaction?.status === 'cancelled'
      ? 'failed'
      : transaction?.status === 'pending' || transaction?.status === 'processing'
        ? 'pending'
        : transaction?.status === 'completed'
          ? 'success'
          : 'info';

  return {
    id: item.id,
    type: kind,
    status,
    title: item.title,
    message: item.body,
    timestamp: formatRelativeTime(item.createdAt),
    read: item.read,
    ...(transaction ? {
      amount: transaction.amount,
      reference: transaction.reference,
      recipient: transaction.counterparty,
    } : {}),
    ...(item.kind === 'security'
      ? { actionRoute: '/account/security' }
      : item.kind === 'request'
        ? { actionRoute: '/money-requests' }
      : transaction
        ? { actionRoute: '/(tabs)/transactions' }
        : {}),
  };
}

export function subscribeNotifications(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotificationsState() {
  return state;
}

export function useNotifications() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const current = useSyncExternalStore(subscribeNotifications, getNotificationsState, getNotificationsState);

  useEffect(() => {
    if (!userId) {
      setState({ userId: null, notifications: [], loading: false, error: null });
    } else if (state.userId !== userId || (!state.loading && state.error)) {
      void reloadNotifications(userId);
    }
  }, [userId]);

  return current.userId === userId
    ? current
    : { userId, notifications: [], loading: Boolean(userId), error: null };
}

export async function reloadNotifications(userId = state.userId): Promise<void> {
  if (!userId || state.loading) return;
  setState({
    userId,
    notifications: state.userId === userId ? state.notifications : [],
    loading: true,
    error: null,
  });
  try {
    const notifications = await listNotifications();
    if (state.userId === userId) {
      setState({
        userId,
        notifications: notifications.map(toNotification),
        loading: false,
        error: null,
      });
    }
  } catch (error) {
    if (state.userId === userId) {
      setState({
        ...state,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

export async function markNotificationRead(id: string) {
  await markApiNotificationRead(id);
  setState({
    ...state,
    notifications: state.notifications.map((item) => item.id === id ? { ...item, read: true } : item),
  });
}

export async function markAllNotificationsRead() {
  await markAllApiNotificationsRead();
  setState({
    ...state,
    notifications: state.notifications.map((item) => ({ ...item, read: true })),
  });
}

export async function deleteNotification(id: string) {
  await deleteApiNotification(id);
  setState({ ...state, notifications: state.notifications.filter((item) => item.id !== id) });
}

export async function clearAllNotifications() {
  await clearApiNotifications();
  setState({ ...state, notifications: [] });
}
