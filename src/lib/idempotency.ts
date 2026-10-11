import { randomUUID } from 'expo-crypto';

/**
 * A collision-resistant idempotency key for a money movement. Generated from a
 * cryptographically secure UUID so a retried request can be safely de-duplicated
 * server-side by `(userId, idempotencyKey)`.
 */
export function newIdempotencyKey(prefix = 'mp'): string {
  return `${prefix}-${randomUUID()}`;
}
