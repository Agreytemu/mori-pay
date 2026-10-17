import { getApps, initializeApp } from 'firebase/app';
import {
  getMessaging,
  isSupported,
  getToken,
  onMessage,
  type Messaging,
} from 'firebase/messaging';

import { registerPushDevice } from './api';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const INSTALLATION_ID_KEY = 'mori.admin.push-installation-id';

export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey,
  );
}

function getInstallationId(): string {
  const existing = window.localStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const installationId = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  window.localStorage.setItem(INSTALLATION_ID_KEY, installationId);
  return installationId;
}

function getApp() {
  return getApps().find((app) => app.name === 'mori-admin-web') ??
    initializeApp(firebaseConfig, 'mori-admin-web');
}

async function getBrowserMessaging(): Promise<Messaging> {
  if (!isPushConfigured()) {
    throw new Error('Browser push configuration is incomplete.');
  }
  if (!(await isSupported())) {
    throw new Error('This browser does not support Firebase messaging.');
  }
  return getMessaging(getApp());
}

async function registerToken(messaging: Messaging): Promise<void> {
  const workerConfig = encodeURIComponent(JSON.stringify(firebaseConfig));
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?config=${workerConfig}`,
    { scope: '/' },
  );
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Firebase did not return a browser token.');

  await registerPushDevice({
    name: 'Mori Pay Admin Portal',
    platform: 'web',
    clientApp: 'admin-web',
    installationId: getInstallationId(),
    token,
  });
}

export async function enableBrowserPush(
  requestPermission: boolean,
): Promise<void> {
  if (!isPushConfigured()) {
    throw new Error('Firebase web configuration is incomplete.');
  }
  if (!(window.isSecureContext || window.location.hostname === 'localhost')) {
    throw new Error('Web push notifications require HTTPS.');
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('This browser does not support web push notifications.');
  }

  const permission = requestPermission
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked in this browser. Allow them in browser settings.'
        : 'Notification permission has not been granted.',
    );
  }

  const messaging = await getBrowserMessaging();
  await registerToken(messaging);
}

export async function listenForForegroundPush(): Promise<() => void> {
  if (
    !isPushConfigured() ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return () => undefined;
  }

  const messaging = await getBrowserMessaging();
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'Mori Pay update';
    const notification = new Notification(title, {
      body: payload.notification?.body ?? 'Open Mori Pay to review your account.',
    });
    notification.onclick = () => {
      const target = new URL('/', window.location.origin);
      if (payload.data?.notificationId) {
        target.searchParams.set('notificationId', payload.data.notificationId);
      }
      if (payload.data?.transactionId) {
        target.searchParams.set('transactionId', payload.data.transactionId);
        target.searchParams.set('tab', 'transactions');
      }
      window.location.assign(target);
    };
  });
}
