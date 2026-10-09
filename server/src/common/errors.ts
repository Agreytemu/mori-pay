/**
 * Domain-level errors thrown by services. The global exception filter maps
 * these to stable API error codes instead of leaking a generic 500.
 */
export type DomainErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'UNBALANCED_LEDGER'
  | 'INVALID_LEDGER_LEG';

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: DomainErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(message = 'Insufficient balance') {
    super(message, 'INSUFFICIENT_FUNDS');
  }
}

export class UnbalancedLedgerError extends DomainError {
  constructor(message = 'Ledger posting does not balance') {
    super(message, 'UNBALANCED_LEDGER');
  }
}

export class InvalidLedgerLegError extends DomainError {
  constructor(message = 'Invalid ledger leg') {
    super(message, 'INVALID_LEDGER_LEG');
  }
}
