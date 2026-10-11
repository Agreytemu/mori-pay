import { BadRequestException } from '@nestjs/common';

/**
 * Explicit lifecycle for a `Transaction`. Rows start `pending` (gateway flows)
 * or are written final in one shot (internal wallet movements). Terminal
 * states never change, so settlement can run the same fix-up many times.
 */
export const TRANSACTION_STATUS = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

/** Allowed forward transitions; terminal states have none. */
const TRANSITIONS: Record<TransactionStatus, readonly TransactionStatus[]> = {
  [TRANSACTION_STATUS.pending]: [
    TRANSACTION_STATUS.processing,
    TRANSACTION_STATUS.completed,
    TRANSACTION_STATUS.failed,
    TRANSACTION_STATUS.cancelled,
  ],
  [TRANSACTION_STATUS.processing]: [
    TRANSACTION_STATUS.completed,
    TRANSACTION_STATUS.failed,
    TRANSACTION_STATUS.cancelled,
  ],
  [TRANSACTION_STATUS.completed]: [],
  [TRANSACTION_STATUS.failed]: [],
  [TRANSACTION_STATUS.cancelled]: [],
};

export function isTerminalStatus(status: string): boolean {
  const allowed = TRANSITIONS[status as TransactionStatus];
  return allowed !== undefined && allowed.length === 0;
}

export function canTransition(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as TransactionStatus];
  if (!allowed) return false;
  return allowed.includes(to as TransactionStatus);
}

export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `Invalid transaction transition: ${from} -> ${to}`,
    );
  }
}
