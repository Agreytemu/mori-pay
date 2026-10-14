import type {
  AccountProfile,
  AuthUser,
  SavedPaymentMethod as ApiSavedPaymentMethod,
  Transaction as ApiTransaction,
  WalletAccount,
} from '@mori-pay/contracts';

import { APP_NAME } from '@/config/app';
import type { SavedPaymentMethod } from '@/data/mock-payment-methods';
import type { UserProfile } from '@/data/profile';
import type { WalletAccountData, WalletAccountStatus, WalletActivity } from '@/data/wallet-account';
import type { IconName } from '@/constants/icons';
import type { Transaction as UiTransaction } from '@/types/transaction';
import { formatDate, formatPhone } from '@/utils/format';

/**
 * Maps API/domain objects from `@mori-pay/contracts` onto the shapes the
 * existing UI components already consume, so screens can wire up the real
 * backend without rewriting presentational code.
 */

const ACTIVITY_ICON: Record<ApiTransaction['type'], IconName> = {
  send: 'send',
  receive: 'receive',
  payment: 'pay',
  request: 'request',
  deposit: 'deposit',
  withdrawal: 'withdraw',
};

export function toWalletData(wallet: WalletAccount, status: WalletAccountStatus): WalletAccountData {
  return {
    brand: APP_NAME,
    accountType: 'Personal account',
    availableBalance: wallet.balance.available,
    currency: 'TZS',
    accountNumber: wallet.accountNumber,
    phoneNumber: wallet.phoneNumber ? formatPhone(wallet.phoneNumber) : 'Not added',
    openedDate: formatDate(wallet.memberSince),
    status,
  };
}

/** Narrows the contract transaction to the UI model (channel union, etc.). */
export function toUiTransaction(tx: ApiTransaction): UiTransaction {
  return {
    ...tx,
    channel: tx.channel,
  };
}

export function toWalletActivity(tx: ApiTransaction): WalletActivity {
  const credit = tx.direction === 'credit';
  return {
    id: tx.id,
    description: tx.note || tx.counterparty,
    date: formatDate(tx.createdAt),
    amount: tx.amount,
    direction: credit ? 'credit' : 'debit',
    status: tx.status === 'completed' ? 'Completed' : 'Pending',
    icon: ACTIVITY_ICON[tx.type],
  };
}

export function userStatusToAccountStatus(status: AuthUser['status']): WalletAccountStatus {
  if (status === 'pending') return 'pending';
  if (status === 'restricted') return 'limited';
  return 'active';
}

export function toUserProfile(profile: AccountProfile): UserProfile {
  return {
    id: profile.id,
    memberId: profile.memberId,
    fullName: profile.fullName,
    phone: profile.phoneNumber ?? '',
    email: profile.email ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    status:
      profile.status === 'restricted'
        ? 'restricted'
        : profile.tier === 'Verified'
          ? 'verified'
          : 'standard',
    tier: profile.tier,
    joinedAt: profile.memberSince,
  };
}

export function toSavedPaymentMethod(method: ApiSavedPaymentMethod): SavedPaymentMethod {
  const identifier = `•••• ${method.lastFour}`;
  return {
    id: method.id,
    kind: method.kind,
    name: method.kind === 'mobile-money'
      ? method.provider
      : method.kind === 'bank'
        ? `${method.provider} account`
        : method.provider,
    provider: method.provider,
    identifier,
    addedDate: formatDate(method.createdAt),
    status: method.status === 'Pending' ? 'Pending' : 'Active',
    isDefault: method.isDefault,
  };
}
