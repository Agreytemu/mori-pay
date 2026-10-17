import { decryptField, encryptField } from './field-encryption.js';

const PAYMENT_METHOD_ENCRYPTION_OPTIONS = {
  envName: 'PAYMENT_METHOD_ENCRYPTION_KEY',
  invalidMessage: 'Stored payment method data is invalid.',
} as const;

export function encryptPaymentMethodPhone(
  phoneNumber: string,
  encodedKey: string | undefined,
): string {
  return encryptField(phoneNumber, encodedKey, PAYMENT_METHOD_ENCRYPTION_OPTIONS);
}

export function decryptPaymentMethodPhone(
  value: string,
  encodedKey: string | undefined,
): string {
  return decryptField(value, encodedKey, PAYMENT_METHOD_ENCRYPTION_OPTIONS);
}
