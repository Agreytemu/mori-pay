import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export type FieldEncryptionOptions = {
  /** Environment variable name used in error messages. */
  envName: string;
  /** Message thrown when stored ciphertext is malformed or tampered with. */
  invalidMessage: string;
};

function decodeKey(encodedKey: string | undefined, envName: string): Buffer {
  if (!encodedKey) {
    throw new Error(`${envName} is not configured.`);
  }
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encodedKey) {
    throw new Error(`${envName} must be a base64-encoded 32-byte key.`);
  }
  return key;
}

/**
 * Encrypts a UTF-8 string with AES-256-GCM, returning a `v1:iv:tag:ciphertext`
 * payload where every part is base64-encoded.
 */
export function encryptField(
  value: string,
  encodedKey: string | undefined,
  options: FieldEncryptionOptions,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, decodeKey(encodedKey, options.envName), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a payload produced by {@link encryptField}. Throws when the payload
 * is malformed, was tampered with, or was encrypted under a different key.
 */
export function decryptField(
  value: string,
  encodedKey: string | undefined,
  options: FieldEncryptionOptions,
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(':');
  if (
    version !== 'v1' ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra.length > 0
  ) {
    throw new Error(options.invalidMessage);
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    decodeKey(encodedKey, options.envName),
    Buffer.from(encodedIv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
