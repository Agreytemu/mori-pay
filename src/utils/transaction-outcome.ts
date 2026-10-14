import type { Transaction } from '@/types/transaction';

export function getTransactionOutcomeReason(transaction: Transaction): string | null {
  if (transaction.status === 'cancelled') {
    return transaction.channel === 'mobileMoney'
      ? 'The mobile-money request was cancelled or expired before approval was completed.'
      : 'The payment was cancelled before it was completed.';
  }

  if (transaction.status !== 'failed') return null;

  if (transaction.channel === 'mobileMoney' && transaction.type === 'withdrawal') {
    return 'The mobile-money network could not complete the payout. Check the recipient number and network availability, then try again.';
  }
  if (transaction.channel === 'mobileMoney') {
    return 'The mobile-money provider declined or could not complete the request. Check the phone number, available balance, and network, then try again.';
  }
  if (transaction.channel === 'card') {
    return 'The card provider declined or could not complete the payment. Check with your card issuer before trying again.';
  }
  return 'The payment could not be completed. Check the transaction details and try again.';
}
