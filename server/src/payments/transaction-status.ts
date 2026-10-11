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

/** Terminal states have no outgoing transitions. */
const TERMINAL_STATUSES: readonly TransactionStatus[] = [
  TRANSACTION_STATUS.completed,
  TRANSACTION_STATUS.failed,
  TRANSACTION_STATUS.cancelled,
];

/** Money-flow transitions; internal wallet movements are final at creation. */
const FLOW_TRANSITIONS: Record<
  string,
  Partial<Record<TransactionStatus, readonly TransactionStatus[]>>
> = {
  deposit: {
    [TRANSACTION_STATUS.pending]: [
      TRANSACTION_STATUS.completed,
      TRANSACTION_STATUS.failed,
    ],
  },
  withdrawal: {
    [TRANSACTION_STATUS.processing]: [
      TRANSACTION_STATUS.completed,
      TRANSACTION_STATUS.failed,
    ],
  },
};

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as TransactionStatus);
}

export function canTransition(
  type: string,
  from: string,
  to: string,
): boolean {
  const allowed =
    FLOW_TRANSITIONS[type]?.[from as TransactionStatus];
  if (!allowed) return false;
  return allowed.includes(to as TransactionStatus);
}

export function assertTransition(
  type: string,
  from: string,
  to: string,
): void {
  if (!canTransition(type, from, to)) {
    throw new BadRequestException(
      `Invalid ${type} transaction transition: ${from} -> ${to}`,
    );
  }
}
