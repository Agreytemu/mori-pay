import { randomUUID } from 'expo-crypto';

/**
 * A collision-resistant idempotency key for a money movement. Generated from a
 * cryptographically secure UUID so a retried request can be safely de-duplicated
 * server-side by `(userId, idempotencyKey)`.
 */
export function newIdempotencyKey(prefix = 'mp'): string {
  return `${prefix}-${randomUUID()}`;
}

export class IdempotencyKeyCache {
  private readonly keys = new Map<string, string>();

  get(intent: string, prefix: string): string {
    let key = this.keys.get(intent);
    if (!key) {
      key = newIdempotencyKey(prefix);
      this.keys.set(intent, key);
    }
    return key;
  }

  clear(intent: string): void {
    this.keys.delete(intent);
  }

  clearAll(): void {
    this.keys.clear();
  }
}
