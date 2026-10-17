import { Platform } from 'react-native';

import * as api from '@/lib/mori-api';
import { deviceInfo } from '@/lib/phone';
import { getNotifications } from '@/lib/notifications';

const ANDROID_CHANNEL_ID = 'transaction-updates';

let registrationInFlight: Promise<void> | null = null;
let pushTokenSubscription: { remove: () => void } | null = null;
let authGeneration = 0;

export function registerCurrentInstallationForPush(): Promise<void> {
  return beginRegistration(false);
}

export function requestAndroidPushPermission(): Promise<void> {
  if (registrationInFlight) {
    return registrationInFlight.then(() => beginRegistration(true));
  }
  return beginRegistration(true);
}

function beginRegistration(requestPermission: boolean): Promise<void> {
  if (registrationInFlight) return registrationInFlight;
  const generation = authGeneration;
  registrationInFlight = register(generation, requestPermission).finally(() => {
    registrationInFlight = null;
  });
  return registrationInFlight;
}

export async function unregisterCurrentInstallationFromPush(): Promise<void> {
  authGeneration += 1;
  pushTokenSubscription?.remove();
  pushTokenSubscription = null;
  const installation = await deviceInfo();
  await api.unregisterPushDevice(installation.installationId!);
}

async function register(
  generation: number,
  requestPermission: boolean,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const notifications = getNotifications();
  if (!notifications) {
    throw new Error('Native notifications require an installed development or production build.');
  }

  await notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Transaction updates',
    importance: notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150, 100, 150],
    lightColor: '#00CDEF',
  });

  let permission = await notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    if (!requestPermission) return;
    permission = await notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    if (requestPermission) {
      throw new Error('Notification permission was not granted. You can enable it in Android settings.');
    }
    return;
  }

  const token = await notifications.getDevicePushTokenAsync();
  if (token.type !== 'android' || typeof token.data !== 'string') {
    throw new Error('Android did not provide a native FCM registration token.');
  }

  await registerToken(token.data, generation);
  if (pushTokenSubscription) return;
  pushTokenSubscription = notifications.addPushTokenListener((updatedToken) => {
    if (updatedToken.type !== 'android' || typeof updatedToken.data !== 'string') {
      console.warn('Received an unsupported Android push token update.');
      return;
    }
    void registerToken(updatedToken.data, generation).catch((error: unknown) => {
      console.warn('Could not update the Mori Pay push token.', error);
    });
  });
}

async function registerToken(token: string, generation: number): Promise<void> {
  if (generation !== authGeneration) return;
  const installation = await deviceInfo();
  if (generation !== authGeneration) return;

  await api.registerPushDevice({
    name: installation.name,
    platform: 'android',
    clientApp: 'mobile',
    installationId: installation.installationId!,
    token,
  });
}
