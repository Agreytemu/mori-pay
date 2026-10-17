import type {
  CardTopupResult,
  FeePreview,
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
  MerchantApplication,
  MerchantApplicationInput,
  MerchantPortal,
  MerchantPortalQrCode,
  MerchantPortalTransaction,
  MerchantPortalTransactions,
  MerchantPaymentPreview,
  MerchantQrCode,
  MerchantQrPreview,
  MerchantRegistrationFee,
  MoneyRequest,
  KycOverview,
  SubmitKycInput,
  OtpChallengeResult,
  Paginated,
  PayMerchantInput,
  PayMerchantResult,
  PayMerchantQrResult,
  PayRequestInput,
  PayRequestResult,
  PinStatus,
  PinSignInInput,
  PreviewTransferInput,
  PromotionPlacement,
  PublicPromotion,
  PublicPromotionsResponse,
  RecipientLookup,
  ReceiveCode,
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
  WithdrawalPreview,
  VerifyOtpInput,
  VerifyOtpResult,
  VerifyEmailInput,
  VerifyPinInput,
  WalletAccount,
  WithdrawalInput,
  WithdrawalResult,
} from '@mori-pay/contracts';

import { request } from './api';

/** Payout lookup data returned by the server. */
export type PayoutLookup = {
  found: boolean;
  phoneNumber: string;
  name?: string;
  network?: string;
};

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

export function getKycOverview(): Promise<KycOverview> {
  return request<KycOverview>('/account/kyc');
}

export function submitKyc(input: SubmitKycInput): Promise<KycOverview> {
  return request<KycOverview>('/account/kyc/submissions', { method: 'POST', body: input });
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

export function getReceiveCode(): Promise<ReceiveCode> {
  return request<ReceiveCode>('/wallet/receive-code');
}

export function verifyReceiveCode(code: string): Promise<RecipientLookup> {
  return request<RecipientLookup>('/transfers/verify-receive-code', {
    method: 'POST',
    body: { code },
  });
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

/* ---------------------------------------------------------------- promotions */

export function listPromotions(
  placement?: PromotionPlacement
): Promise<PublicPromotionsResponse> {
  return request<PublicPromotionsResponse>('/promotions', { query: { placement } });
}

/** Convenience wrapper returning the first active promotion for a placement. */
export async function getActivePromotion(
  placement: PromotionPlacement
): Promise<PublicPromotion | null> {
  const { items } = await listPromotions(placement);
  return items[0] ?? null;
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

export function topupCardPreview(amount: number): Promise<FeePreview> {
  return request<FeePreview>('/topups/card/preview', { query: { amount } });
}

export function topupMobileMoneyPreview(amount: number): Promise<FeePreview> {
  return request<FeePreview>('/topups/mobile-money/preview', { query: { amount } });
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

export function previewMerchantPayment(input: {
  merchantId: string;
  amount: number;
}): Promise<MerchantPaymentPreview> {
  return request<MerchantPaymentPreview>('/merchants/preview', {
    method: 'POST',
    body: input,
  });
}

export function listMerchants(): Promise<Merchant[]> {
  return request<Merchant[]>('/merchants');
}

export function payMerchant(input: PayMerchantInput): Promise<PayMerchantResult> {
  return request<PayMerchantResult>('/merchants/pay', { method: 'POST', body: input });
}

export function getMerchantApplication(): Promise<MerchantApplication | null> {
  return request<MerchantApplication | null>('/merchants/application');
}

export function getMerchantRegistrationFee(): Promise<MerchantRegistrationFee> {
  return request<MerchantRegistrationFee>('/merchants/registration-fee');
}

export function applyForMerchant(input: MerchantApplicationInput): Promise<MerchantApplication> {
  return request<MerchantApplication>('/merchants/application', { method: 'POST', body: input });
}

export function payMerchantRegistrationFee(input: {
  pin: string;
  idempotencyKey: string;
}): Promise<MerchantApplication> {
  return request<MerchantApplication>('/merchants/application/payment', {
    method: 'POST',
    body: input,
  });
}

export function createMerchantStaticQr(input: {
  expiresAt?: string;
}): Promise<MerchantQrCode> {
  return request<MerchantQrCode>('/merchants/qr/static', { method: 'POST', body: input });
}

export function createMerchantFixedQr(input: {
  amount: number;
  reusable: boolean;
  expiresAt?: string;
}): Promise<MerchantQrCode> {
  return request<MerchantQrCode>('/merchants/qr/fixed', { method: 'POST', body: input });
}

export function previewMerchantQr(input: {
  code: string;
  amount?: number;
}): Promise<MerchantQrPreview> {
  return request<MerchantQrPreview>('/merchants/qr/preview', { method: 'POST', body: input });
}

export function payMerchantQr(input: {
  code: string;
  amount?: number;
  pin: string;
  idempotencyKey: string;
}): Promise<PayMerchantQrResult> {
  return request<PayMerchantQrResult>('/merchants/qr/pay', { method: 'POST', body: input });
}

export function revokeMerchantQr(codeId: string): Promise<void> {
  return request<void>(`/merchants/qr/${encodeURIComponent(codeId)}/revoke`, {
    method: 'POST',
  });
}

export type MerchantPortalFilters = {
  from?: string;
  to?: string;
  search?: string;
  status?: string;
  type?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
};

export function getMerchantPortal(
  filters: Pick<MerchantPortalFilters, 'from' | 'to'> = {},
): Promise<MerchantPortal> {
  return request<MerchantPortal>('/merchants/portal', { query: filters });
}

export function listMerchantPortalTransactions(
  filters: MerchantPortalFilters = {},
): Promise<MerchantPortalTransactions> {
  return request<MerchantPortalTransactions>('/merchants/portal/transactions', {
    query: filters,
  });
}

export function getMerchantPortalTransaction(
  transactionId: string,
): Promise<MerchantPortalTransaction> {
  return request<MerchantPortalTransaction>(
    `/merchants/portal/transactions/${encodeURIComponent(transactionId)}`,
  );
}

export function listMerchantPortalQrCodes(): Promise<MerchantPortalQrCode[]> {
  return request<MerchantPortalQrCode[]>('/merchants/portal/qr');
}

export function exportMerchantPortalTransactions(
  filters: Omit<MerchantPortalFilters, 'page' | 'pageSize'> = {},
): Promise<Blob> {
  return request<Blob>('/merchants/portal/transactions/export.csv', {
    query: filters,
    responseType: 'blob',
  });
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
