type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * Loads `expo-notifications` lazily so an environment missing its native
 * modules degrades gracefully instead of crashing at import time. Expo Go on
 * Android (SDK 53+) does not bundle the topic-subscription native module, and
 * merely importing the package throws there. A development build provides the
 * full module. Returns `null` when notifications are unavailable.
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn(
      'Native notifications are unavailable in this environment. A development build is required for full notification support.',
      error,
    );
    cached = null;
  }

  return cached;
}
