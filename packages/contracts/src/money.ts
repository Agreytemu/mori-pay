/**
 * Money primitives.
 *
 * All TZS amounts are whole integers (the currency has no minor unit in
 * practice, and Abliner requires whole numbers). Never use floating point
 * arithmetic on amounts.
 */

export const CURRENCY = 'TZS' as const;

export type Currency = typeof CURRENCY;

/** Integer amount of TZS. Example: `5000` === TSh 5,000. */
export type Amount = number;

export type Direction = 'credit' | 'debit';
