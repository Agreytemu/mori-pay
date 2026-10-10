import { Platform } from 'react-native';

/** Normalises a Tanzanian phone number into the `255XXXXXXXXX` API format. */
export function normalizeTzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('255')) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9 && /^[78]/.test(digits)) return `255${digits}`;
  return null;
}

type PlatformName = 'android' | 'ios' | 'web';

/** Platform descriptor sent with OTP verification so the API can register a device. */
export function deviceInfo(): { name: string; platform: PlatformName } {
  const platform: PlatformName =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  return { name: 'Mori Pay app', platform };
}
