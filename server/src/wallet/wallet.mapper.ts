import type {
  AuthUser,
  Transaction as TransactionDto,
  WalletAccount,
  WalletBalance,
} from '@mori-pay/contracts';

import type {
  LedgerAccount,
  Transaction,
  User,
  Wallet,
} from '../generated/prisma/client.js';

/**
 * Placeholder daily limit until the limits/limits-usage milestone wires
 * real per-tier rules from the `LimitUsage`/`FeeRule` tables.
 */
export const DAILY_LIMIT_DEFAULT = 1_000_000;

export const LEDGER_ACCOUNT_AVAILABLE = 'available';
export const LEDGER_ACCOUNT_PENDING = 'pending';

export type UserWithWallet = User & {
  wallet: (Wallet & { ledgerAccounts: LedgerAccount[] }) | null;
};

function balanceOf(accounts: LedgerAccount[], kind: string): bigint {
  return accounts.find((account) => account.kind === kind)?.balance ?? 0n;
}

/** Available ledger account id for a user, or `undefined` when absent. */
export function findAvailableAccountId(user: UserWithWallet): string | undefined {
  return user.wallet?.ledgerAccounts.find(
    (account) => account.kind === LEDGER_ACCOUNT_AVAILABLE,
  )?.id;
}

export function toWalletBalance(
  wallet: Wallet & { ledgerAccounts: LedgerAccount[] },
): WalletBalance {
  return {
    available: Number(balanceOf(wallet.ledgerAccounts, LEDGER_ACCOUNT_AVAILABLE)),
    pending: Number(balanceOf(wallet.ledgerAccounts, LEDGER_ACCOUNT_PENDING)),
    dailyLimitRemaining: DAILY_LIMIT_DEFAULT,
    dailyLimit: DAILY_LIMIT_DEFAULT,
  };
}

export function toAuthUser(user: UserWithWallet): AuthUser {
  return {
    id: user.id,
    memberId: user.memberId,
    fullName: user.fullName,
    firstName: user.firstName,
    phoneNumber: user.phone,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    tier: user.tier,
    kycLevel: user.kycLevel,
    status: user.status,
    currency: (user.wallet?.currency ?? 'TZS') as AuthUser['currency'],
  };
}

export function toWalletAccount(user: UserWithWallet): WalletAccount {
  const wallet = user.wallet;
  if (!wallet) throw new Error('Wallet not found');

  return {
    id: wallet.id,
    fullName: user.fullName,
    firstName: user.firstName,
    phoneNumber: user.phone,
    accountNumber: wallet.accountNumber,
    nationalId: user.nationalId ? `****${user.nationalId.slice(-4)}` : '',
    email: user.email ?? '',
    tier: user.tier,
    memberSince: user.createdAt.toISOString(),
    currency: wallet.currency as WalletAccount['currency'],
    balance: toWalletBalance(wallet),
  };
}

export function toTransaction(transaction: Transaction): TransactionDto {
  return {
    id: transaction.id,
    reference: transaction.reference,
    type: transaction.type as TransactionDto['type'],
    status: transaction.status as TransactionDto['status'],
    category: transaction.category as TransactionDto['category'],
    channel: transaction.channel as TransactionDto['channel'],
    amount: Number(transaction.amount),
    currency: transaction.currency as TransactionDto['currency'],
    fee: Number(transaction.fee),
    counterparty: transaction.counterparty,
    counterpartyDetail: transaction.counterpartyDetail ?? undefined,
    note: transaction.note ?? undefined,
    direction: transaction.direction as TransactionDto['direction'],
    createdAt: transaction.createdAt.toISOString(),
  };
}
