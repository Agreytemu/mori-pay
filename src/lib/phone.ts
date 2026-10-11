import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { DeviceInfo } from '@mori-pay/contracts';

/** Normalises a Tanzanian phone number into the `255XXXXXXXXX` API format. */
export function normalizeTzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('255')) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9 && /^[78]/.test(digits)) return `255${digits}`;
  return null;
}

type PlatformName = 'android' | 'ios' | 'web';

const INSTALLATION_ID_KEY = 'mori-pay-installation-id';

/** Platform descriptor and stable installation identity sent during authentication. */
export async function deviceInfo(): Promise<DeviceInfo> {
  const platform: PlatformName =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  let installationId: string | null;
  if (Platform.OS === 'web') {
    installationId = globalThis.localStorage.getItem(INSTALLATION_ID_KEY);
    if (!installationId) {
      installationId = Array.from(Crypto.getRandomBytes(24), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      globalThis.localStorage.setItem(INSTALLATION_ID_KEY, installationId);
    }
  } else {
    installationId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    if (!installationId) {
      installationId = Array.from(Crypto.getRandomBytes(24), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
    }
  }
  return { name: 'Mori Pay app', platform, installationId };
}
