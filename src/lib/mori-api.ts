import type {
  CardTopupResult,
  AuthSession,
  AuthTokens,
  AuthUser,
  AccountProfile,
  AppNotification,
  ChangePinInput,
  EmailCredentialsInput,
  EmailRegisterInput,
  EmailSignInInput,
  Merchant,
  MoneyRequest,
  OtpChallengeResult,
  Paginated,
  PayMerchantInput,
  PayMerchantResult,
  PayRequestInput,
  PayRequestResult,
  PinStatus,
  PinSignInInput,
  PreviewTransferInput,
  RecipientLookup,
  RefreshTokenInput,
  RegisterInput,
  RequestMoneyInput,
  RequestMoneyResult,
  RequestOtpInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  NotificationPreference,
  SavedPaymentMethod,
  TrustedDevice,
  UpdateAccountProfileInput,
  UpdateNotificationPreferencesInput,
  SavePaymentMethodInput,
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
  VerifyEmailInput,
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

export function requestPhoneLink(input: RequestOtpInput): Promise<OtpChallengeResult> {
  return request<OtpChallengeResult>('/auth/phone/request-link', {
    method: 'POST',
    body: input,
  });
}

export function verifyPhoneLink(input: VerifyOtpInput): Promise<void> {
  return request<void>('/auth/phone/verify-link', {
    method: 'POST',
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

export function signInWithEmail(input: EmailSignInInput): Promise<AuthSession> {
  return request<AuthSession>('/auth/email/login', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function signInWithPin(input: PinSignInInput): Promise<AuthSession> {
  return request<AuthSession>('/auth/pin/login', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function registerEmail(input: EmailRegisterInput): Promise<OtpChallengeResult> {
  return request<OtpChallengeResult>('/auth/email/register', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function verifyEmail(input: VerifyEmailInput): Promise<AuthSession> {
  return request<AuthSession>('/auth/email/verify', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function resendEmailVerification(email: string): Promise<OtpChallengeResult> {
  return request<OtpChallengeResult>('/auth/email/resend', {
    method: 'POST',
    auth: false,
    body: { email },
  });
}

export function requestPasswordReset(
  input: RequestPasswordResetInput
): Promise<OtpChallengeResult> {
  return request<OtpChallengeResult>('/auth/password/reset/request', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function resetPassword(input: ResetPasswordInput): Promise<void> {
  return request<void>('/auth/password/reset', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export function setEmailCredentials(input: EmailCredentialsInput): Promise<OtpChallengeResult> {
  return request<OtpChallengeResult>('/auth/email/credentials', {
    method: 'POST',
    body: input,
  });
}

export function refreshTokens(input: RefreshTokenInput): Promise<AuthTokens> {
  return request<AuthTokens>('/auth/refresh', { method: 'POST', auth: false, body: input });
}

export function fetchMe(): Promise<{ user: AuthUser; wallet: WalletAccount }> {
  return request<{ user: AuthUser; wallet: WalletAccount }>('/auth/me');
}

export function getAccountProfile(): Promise<AccountProfile> {
  return request<AccountProfile>('/account/profile');
}

export function updateAccountProfile(input: UpdateAccountProfileInput): Promise<AccountProfile> {
  return request<AccountProfile>('/account/profile', { method: 'PATCH', body: input });
}

export function listTrustedDevices(): Promise<TrustedDevice[]> {
  return request<TrustedDevice[]>('/account/devices');
}

export function removeTrustedDevice(id: string): Promise<void> {
  return request<void>(`/account/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listSavedPaymentMethods(): Promise<SavedPaymentMethod[]> {
  return request<SavedPaymentMethod[]>('/account/payment-methods');
}

export function savePaymentMethod(input: SavePaymentMethodInput): Promise<SavedPaymentMethod> {
  return request<SavedPaymentMethod>('/account/payment-methods', { method: 'POST', body: input });
}

export function updateSavedPaymentMethod(
  id: string,
  input: SavePaymentMethodInput
): Promise<SavedPaymentMethod> {
  return request<SavedPaymentMethod>(`/account/payment-methods/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function removeSavedPaymentMethod(id: string): Promise<void> {
  return request<void>(`/account/payment-methods/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listNotifications(): Promise<AppNotification[]> {
  return request<AppNotification[]>('/account/notifications');
}

export function markNotificationRead(id: string): Promise<void> {
  return request<void>(`/account/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead(): Promise<void> {
  return request<void>('/account/notifications/read-all', { method: 'PATCH' });
}

export function deleteNotification(id: string): Promise<void> {
  return request<void>(`/account/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function clearNotifications(): Promise<void> {
  return request<void>('/account/notifications', { method: 'DELETE' });
}

export function getNotificationPreferences(): Promise<NotificationPreference> {
  return request<NotificationPreference>('/account/notification-preferences');
}

export function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput
): Promise<NotificationPreference> {
  return request<NotificationPreference>('/account/notification-preferences', {
    method: 'PATCH',
    body: input,
  });
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
