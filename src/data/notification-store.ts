import { useSyncExternalStore } from 'react';

import { MOCK_NOTIFICATIONS } from '@/data/mock-notifications';

let notifications = [...MOCK_NOTIFICATIONS];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeNotifications(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotifications() {
  return notifications;
}

export function useNotifications() {
  return useSyncExternalStore(subscribeNotifications, getNotifications, getNotifications);
}

export function markNotificationRead(id: string) {
  notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  notify();
}

export function markAllNotificationsRead() {
  notifications = notifications.map((n) => ({ ...n, read: true }));
  notify();
}

export function deleteNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  notify();
}

export function clearAllNotifications() {
  notifications = [];
  notify();
}
