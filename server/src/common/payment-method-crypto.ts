import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function decodeKey(encodedKey: string | undefined): Buffer {
  if (!encodedKey) {
    throw new Error('PAYMENT_METHOD_ENCRYPTION_KEY is not configured.');
  }
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encodedKey) {
    throw new Error('PAYMENT_METHOD_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

export function encryptPaymentMethodPhone(
  phoneNumber: string,
  encodedKey: string | undefined,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, decodeKey(encodedKey), iv);
  const encrypted = Buffer.concat([
    cipher.update(phoneNumber, 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptPaymentMethodPhone(
  value: string,
  encodedKey: string | undefined,
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(':');
  if (
    version !== 'v1' ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra.length > 0
  ) {
    throw new Error('Stored payment method data is invalid.');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    decodeKey(encodedKey),
    Buffer.from(encodedIv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
