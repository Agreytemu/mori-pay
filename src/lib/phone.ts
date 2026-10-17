import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { DeviceInfo } from '@mori-pay/contracts';

/** Normalises a Tanzanian phone number into the `255XXXXXXXXX` API format. */
export function normalizeTzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('255')) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9 && /^[678]/.test(digits)) return `255${digits}`;
  return null;
}

/**
 * Reduces a raw phone input to the nine local digits shown after the static
 * `+255` prefix: strips non-digits, drops a leading country code or `0`, and
 * caps the result at nine digits.
 */
export function getTzPhoneInputDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('255')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 9);
}

/** Formats a `255XXXXXXXXX` (or local) number for display, e.g. `+255 712 345 678`. */
export function prettyTzPhone(raw: string): string {
  const normalized = normalizeTzPhone(raw) ?? raw.replace(/\D/g, '');
  if (normalized.length !== 12) return normalized;
  return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
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
