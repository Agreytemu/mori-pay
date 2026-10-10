import type {
  CardTopupResult,
  AuthSession,
  AuthTokens,
  AuthUser,
  ChangePinInput,
  Merchant,
  MoneyRequest,
  OtpChallengeResult,
  Paginated,
  PayMerchantInput,
  PayMerchantResult,
  PayRequestInput,
  PayRequestResult,
  PinStatus,
  PreviewTransferInput,
  RecipientLookup,
  RefreshTokenInput,
  RegisterInput,
  RequestMoneyInput,
  RequestMoneyResult,
  RequestOtpInput,
  SendMoneyInput,
  SendMoneyResult,
  SetPinInput,
  TopupCardInput,
  TopupInitResult,
  TopupMobileMoneyInput,
  Transaction,
  TransferPreview,
  VerifyOtpInput,
  VerifyOtpResult,
  VerifyPinInput,
  WalletAccount,
  WithdrawalInput,
  WithdrawalResult,
} from '@mori-pay/contracts';

import { request } from './api';

/** Abliner payout lookup mirror of the server's `RecipientLookupResult`. */
export type PayoutLookup = {
  found: boolean;
  phoneNumber: string;
  name?: string;
  network?: string;
};

export type WithdrawalPreview = { amount: number; fee: number; total: number };

/* --------------------------------------------------------------------- auth */

export function requestOtp(input: RequestOtpInput): Promise<OtpChallengeResult> {
  return request<OtpChallengeResult>('/auth/otp/request', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  return request<VerifyOtpResult>('/auth/otp/verify', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function register(input: RegisterInput): Promise<AuthSession> {
  return request<AuthSession>('/auth/register', { method: 'POST', auth: false, body: input });
}

export function refreshTokens(input: RefreshTokenInput): Promise<AuthTokens> {
  return request<AuthTokens>('/auth/refresh', { method: 'POST', auth: false, body: input });
}

export function fetchMe(): Promise<{ user: AuthUser; wallet: WalletAccount }> {
  return request<{ user: AuthUser; wallet: WalletAccount }>('/auth/me');
}

export function fetchPinStatus(): Promise<PinStatus> {
  return request<PinStatus>('/auth/pin/status');
}

export function setPin(input: SetPinInput): Promise<PinStatus> {
  return request<PinStatus>('/auth/pin/set', { method: 'POST', body: input });
}

export function verifyPin(input: VerifyPinInput): Promise<PinStatus> {
  return request<PinStatus>('/auth/pin/verify', { method: 'POST', body: input });
}

export function changePin(input: ChangePinInput): Promise<PinStatus> {
  return request<PinStatus>('/auth/pin/change', { method: 'POST', body: input });
}

/* -------------------------------------------------------------------- wallet */

export function getWallet(): Promise<WalletAccount> {
  return request<WalletAccount>('/wallet');
}

export function listTransactions(params: {
  q?: string;
  type?: string;
  status?: string;
  cursor?: string | null;
  limit?: number;
} = {}): Promise<Paginated<Transaction>> {
  const { q, type, status, cursor, limit } = params;
  return request<Paginated<Transaction>>('/wallet/transactions', {
    query: { q, type, status, cursor: cursor ?? undefined, limit },
  });
}

export function getTransaction(id: string): Promise<Transaction> {
  return request<Transaction>(`/wallet/transactions/${encodeURIComponent(id)}`);
}

/* -------------------------------------------------------------------- topups */

export function topupMobileMoney(
  input: TopupMobileMoneyInput
): Promise<TopupInitResult> {
  return request<TopupInitResult>('/topups/mobile-money', { method: 'POST', body: input });
}

export function topupCard(input: TopupCardInput): Promise<CardTopupResult> {
  return request<CardTopupResult>('/topups/card', { method: 'POST', body: input });
}

/* ---------------------------------------------------------------- withdrawals */

export function withdrawalPreview(amount: number): Promise<WithdrawalPreview> {
  return request<WithdrawalPreview>('/withdrawals/preview', { query: { amount } });
}

export function withdrawalLookup(phone: string): Promise<PayoutLookup> {
  return request<PayoutLookup>('/withdrawals/lookup', { query: { phone } });
}

export function createWithdrawal(input: WithdrawalInput): Promise<WithdrawalResult> {
  return request<WithdrawalResult>('/withdrawals', { method: 'POST', body: input });
}

/* ------------------------------------------------------------------ transfers */

export function lookupRecipient(phone: string): Promise<RecipientLookup> {
  return request<RecipientLookup>('/transfers/recipient', { query: { phone } });
}

export function previewTransfer(input: PreviewTransferInput): Promise<TransferPreview> {
  return request<TransferPreview>('/transfers/preview', { method: 'POST', body: input });
}

export function sendMoney(input: SendMoneyInput): Promise<SendMoneyResult> {
  return request<SendMoneyResult>('/transfers/send', { method: 'POST', body: input });
}

/* ----------------------------------------------------------------- merchants */

export function listMerchants(): Promise<Merchant[]> {
  return request<Merchant[]>('/merchants');
}

export function payMerchant(input: PayMerchantInput): Promise<PayMerchantResult> {
  return request<PayMerchantResult>('/merchants/pay', { method: 'POST', body: input });
}

/* ------------------------------------------------------------------ requests */

export function listRequests(): Promise<MoneyRequest[]> {
  return request<MoneyRequest[]>('/requests');
}

export function createRequest(input: RequestMoneyInput): Promise<RequestMoneyResult> {
  return request<RequestMoneyResult>('/requests', { method: 'POST', body: input });
}

export function payRequest(id: string, input: PayRequestInput): Promise<PayRequestResult> {
  return request<PayRequestResult>(`/requests/${encodeURIComponent(id)}/pay`, {
    method: 'POST',
    body: input,
  });
}

export function cancelRequest(id: string): Promise<void> {
  return request<void>(`/requests/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}
