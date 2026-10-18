import type {
  AdminAuditPage,
  AdminHealth,
  AdminFeeRule,
  AdminFeeRuleInput,
  AdminFeeRuleUpdate,
  AdminReconciliationPage,
  AdminReport,
  AdminSessionSearchPage,
  AdminStaffRole,
  AdminStaffSearchPage,
  AdminMerchantAccountPage,
  AdminMerchantApplicationPage,
  AdminKycSubmissionDetail,
  AdminKycSubmissionPage,
  AdminKycSubmissionStatus,
  AdminOverview,
  AdminSession,
  AdminSystemSettings,
  AdminPaymentProviderUpdate,
  AdminPaymentMethodVisibility,
  AdminTransactionDetail,
  AdminTransactionSearchPage,
  AdminUserDetail,
  AdminUserSearchPage,
  AdminWebhookEventPage,
  AuthSession,
  Promotion,
  PromotionInput,
  PromotionPage,
  PromotionUpdate,
  RegistrationFee,
} from './types';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type StoredSession = AuthTokens & {
  expiresAt: number;
  firstName: string;
};

const API_URL = (import.meta.env.VITE_MORI_API_URL ?? '').replace(/\/+$/, '');
const SESSION_KEY = 'mori.admin.session';
let refreshInFlight: Promise<boolean> | null = null;

export class AdminApiError extends Error {
  constructor(readonly status: number) {
    super('Mori Pay request failed');
    this.name = 'AdminApiError';
  }
}

function getStoredSession(): StoredSession | null {
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as StoredSession;
    if (
      !value.accessToken ||
      !value.refreshToken ||
      !Number.isFinite(value.expiresAt) ||
      typeof value.firstName !== 'string'
    ) {
      clearSession();
      return null;
    }
    return value;
  } catch {
    clearSession();
    return null;
  }
}

function storeSession(tokens: AuthTokens, firstName: string): void {
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...tokens,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      firstName,
    } satisfies StoredSession),
  );
}

export function clearSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}

function apiUrl(path: string): string {
  if (!API_URL) throw new AdminApiError(0);
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const current = getStoredSession();
  if (!current) return false;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        clearSession();
        return false;
      }
      const tokens = (await response.json()) as AuthTokens;
      storeSession(tokens, current.firstName);
      return true;
    } catch (error) {
      if (error instanceof AdminApiError) throw error;
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function fetchJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    accessToken?: string;
    retry?: boolean;
    query?: Record<string, string | number>;
  } = {},
): Promise<T> {
  const current = getStoredSession();
  const accessToken = options.accessToken ?? current?.accessToken;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    const target = new URL(apiUrl(path));
    for (const [key, value] of Object.entries(options.query ?? {})) {
      target.searchParams.set(key, String(value));
    }
    response = await fetch(target, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(0);
  }

  if (
    response.status === 401 &&
    current?.refreshToken &&
    options.retry !== false &&
    (await refreshSession())
  ) {
    return fetchJson<T>(path, { ...options, retry: false });
  }
  if (!response.ok) throw new AdminApiError(response.status);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function signIn(email: string, password: string): Promise<AdminSession> {
  const auth = await fetchJson<AuthSession>('/auth/email/login', {
    method: 'POST',
    body: { email, password },
  });

  let adminSession: AdminSession;
  try {
    adminSession = await fetchJson<AdminSession>('/admin/session', {
      accessToken: auth.tokens.accessToken,
    });
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      throw new AdminApiError(403);
    }
    throw error;
  }

  if (
    adminSession.role !== 'admin' ||
    !adminSession.capabilities.includes('admin:access')
  ) {
    throw new AdminApiError(403);
  }

  storeSession(auth.tokens, auth.user.firstName);
  return adminSession;
}

export async function verifyAdminSession(): Promise<AdminSession> {
  return fetchJson<AdminSession>('/admin/session');
}

export function getOverview(): Promise<AdminOverview> {
  return fetchJson<AdminOverview>('/admin/overview');
}

export function getAdminSystemSettings(): Promise<AdminSystemSettings> {
  return fetchJson<AdminSystemSettings>('/admin/settings');
}

export function updatePaymentProviders(
  settings: AdminPaymentProviderUpdate,
): Promise<AdminSystemSettings['paymentProviders']> {
  return fetchJson<AdminSystemSettings['paymentProviders']>(
    '/admin/payment-providers',
    { method: 'PATCH', body: settings },
  );
}

export function updatePaymentMethodVisibility(
  visibility: AdminPaymentMethodVisibility,
): Promise<AdminSystemSettings['paymentProviders']> {
  return fetchJson<AdminSystemSettings['paymentProviders']>(
    '/admin/payment-methods',
    { method: 'PATCH', body: visibility },
  );
}

export function listAudit(
  page = 1,
  pageSize = 20,
  filters: { action?: string; from?: string; to?: string } = {},
): Promise<AdminAuditPage> {
  return fetchJson<AdminAuditPage>('/admin/audit', {
    query: {
      page,
      pageSize,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    },
  });
}

export function searchAdminStaff(
  q: string,
  page = 1,
  pageSize = 20,
): Promise<AdminStaffSearchPage> {
  return fetchJson<AdminStaffSearchPage>('/admin/staff', {
    query: { q, page, pageSize },
  });
}

export function updateAdminStaffRole(
  userId: string,
  role: AdminStaffRole | null,
): Promise<{ userId: string; staffRole: AdminStaffRole | null }> {
  return fetchJson(`/admin/staff/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

export function listMerchantApplications(
  page = 1,
  pageSize = 10,
): Promise<AdminMerchantApplicationPage> {
  return fetchJson<AdminMerchantApplicationPage>('/merchants/admin/applications', {
    query: { page, pageSize },
  });
}

export function listMerchantAccounts(
  page = 1,
  pageSize = 10,
): Promise<AdminMerchantAccountPage> {
  return fetchJson<AdminMerchantAccountPage>('/admin/merchants', {
    query: { page, pageSize },
  });
}

export function searchAdminUsers(
  q = '',
  page = 1,
  pageSize = 20,
): Promise<AdminUserSearchPage> {
  return fetchJson<AdminUserSearchPage>('/admin/users', {
    query: { page, pageSize, ...(q ? { q } : {}) },
  });
}

export function getAdminUser(userId: string): Promise<AdminUserDetail> {
  return fetchJson<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`);
}

export function searchAdminTransactions(
  q = '',
  page = 1,
  pageSize = 20,
): Promise<AdminTransactionSearchPage> {
  return fetchJson<AdminTransactionSearchPage>('/admin/transactions', {
    query: { page, pageSize, ...(q ? { q } : {}) },
  });
}

export function getAdminTransaction(transactionId: string): Promise<AdminTransactionDetail> {
  return fetchJson<AdminTransactionDetail>(
    `/admin/transactions/${encodeURIComponent(transactionId)}`,
  );
}

export function getRegistrationFee(): Promise<RegistrationFee> {
  return fetchJson<RegistrationFee>('/merchants/registration-fee');
}

export function reviewMerchantApplication(
  applicationId: string,
  decision: 'approved' | 'rejected',
  reviewNote?: string,
) {
  return fetchJson(`/merchants/admin/applications/${encodeURIComponent(applicationId)}/review`, {
    method: 'PATCH',
    body: { decision, ...(reviewNote ? { reviewNote } : {}) },
  });
}

export function updateMerchantAccountStatus(
  accountId: string,
  status: 'active' | 'suspended' | 'revoked',
  reason: string,
) {
  return fetchJson(`/merchants/admin/accounts/${encodeURIComponent(accountId)}/status`, {
    method: 'PATCH',
    body: { status, reason },
  });
}

export function updateRegistrationFee(amount: number): Promise<RegistrationFee> {
  return fetchJson<RegistrationFee>('/merchants/admin/registration-fee', {
    method: 'PATCH',
    body: { amount },
  });
}

export function createAdminFeeRule(input: AdminFeeRuleInput): Promise<AdminFeeRule> {
  return fetchJson('/admin/fee-rules', { method: 'POST', body: input });
}

export function updateAdminFeeRule(
  id: string,
  input: AdminFeeRuleUpdate,
): Promise<AdminFeeRule> {
  return fetchJson(`/admin/fee-rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteAdminFeeRule(id: string): Promise<void> {
  return fetchJson(`/admin/fee-rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function updateAdminUserStatus(
  userId: string,
  status: 'active' | 'pending' | 'restricted',
  reason?: string,
): Promise<{ id: string; status: string }> {
  return fetchJson(`/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: { status, ...(reason ? { reason } : {}) },
  });
}

export function updateAdminUserKyc(
  userId: string,
  kycLevel: number,
  reason?: string,
): Promise<{ id: string; kycLevel: number }> {
  return fetchJson(`/admin/users/${encodeURIComponent(userId)}/kyc`, {
    method: 'PATCH',
    body: { kycLevel, ...(reason ? { reason } : {}) },
  });
}

export function updateAdminUserTier(
  userId: string,
  tier: 'Standard' | 'Verified',
  reason?: string,
): Promise<{ id: string; tier: string }> {
  return fetchJson(`/admin/users/${encodeURIComponent(userId)}/tier`, {
    method: 'PATCH',
    body: { tier, ...(reason ? { reason } : {}) },
  });
}

export function revokeAdminUserSessions(
  userId: string,
): Promise<{ revoked: number }> {
  return fetchJson(`/admin/users/${encodeURIComponent(userId)}/sessions/revoke`, {
    method: 'POST',
  });
}

export function revokeAdminUserDevice(
  userId: string,
  deviceId: string,
): Promise<{ id: string; revokedAt: string }> {
  return fetchJson(
    `/admin/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/revoke`,
    { method: 'POST' },
  );
}

export function listAdminSessions(
  page = 1,
  pageSize = 20,
  filters: { q?: string; state?: 'active' | 'revoked' } = {},
): Promise<AdminSessionSearchPage> {
  return fetchJson<AdminSessionSearchPage>('/admin/sessions', {
    query: {
      page,
      pageSize,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.state ? { state: filters.state } : {}),
    },
  });
}

export function listAdminWebhooks(
  page = 1,
  pageSize = 20,
  filters: { q?: string; state?: 'pending' | 'processed' | 'failed' } = {},
): Promise<AdminWebhookEventPage> {
  return fetchJson<AdminWebhookEventPage>('/admin/webhooks', {
    query: {
      page,
      pageSize,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.state ? { state: filters.state } : {}),
    },
  });
}

export function listAdminReconciliation(
  page = 1,
  pageSize = 20,
  state: 'stale' | 'unsettled' | 'all' = 'stale',
): Promise<AdminReconciliationPage> {
  return fetchJson<AdminReconciliationPage>('/admin/reconciliation', {
    query: { page, pageSize, state },
  });
}

export function runAdminReconciliation(): Promise<{ checked: number }> {
  return fetchJson('/admin/reconciliation/run', { method: 'POST' });
}

export function getAdminReport(from?: string, to?: string): Promise<AdminReport> {
  return fetchJson<AdminReport>('/admin/reports', {
    query: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  });
}

export function getAdminHealth(): Promise<AdminHealth> {
  return fetchJson<AdminHealth>('/admin/health');
}

export function listAdminKycSubmissions(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
  q = '',
  page = 1,
  pageSize = 20,
): Promise<AdminKycSubmissionPage> {
  return fetchJson<AdminKycSubmissionPage>('/admin/kyc', {
    query: { status, page, pageSize, ...(q ? { q } : {}) },
  });
}

export function getAdminKycSubmission(submissionId: string): Promise<AdminKycSubmissionDetail> {
  return fetchJson<AdminKycSubmissionDetail>(
    `/admin/kyc/${encodeURIComponent(submissionId)}`,
  );
}

export function decideAdminKycSubmission(
  submissionId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<{ id: string; status: AdminKycSubmissionStatus }> {
  return fetchJson(`/admin/kyc/${encodeURIComponent(submissionId)}/decision`, {
    method: 'POST',
    body: { decision, ...(reason ? { reason } : {}) },
  });
}

export function listAdminPromotions(page = 1, pageSize = 20): Promise<PromotionPage> {
  return fetchJson<PromotionPage>('/admin/promotions', {
    query: { page, pageSize },
  });
}

export function createAdminPromotion(input: PromotionInput): Promise<Promotion> {
  return fetchJson('/admin/promotions', { method: 'POST', body: input });
}

export function updateAdminPromotion(
  id: string,
  input: PromotionUpdate,
): Promise<Promotion> {
  return fetchJson(`/admin/promotions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteAdminPromotion(id: string): Promise<void> {
  return fetchJson(`/admin/promotions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getSignedInFirstName(): string {
  return getStoredSession()?.firstName ?? 'Administrator';
}

export function hasSession(): boolean {
  return getStoredSession() !== null;
}

export async function signOut(): Promise<void> {
  const current = getStoredSession();
  try {
    if (current) {
      const installationId = window.localStorage.getItem('mori.admin.push-installation-id');
      if (installationId) {
        try {
          await unregisterPushDevice(installationId);
        } catch (error) {
          console.warn('Could not unregister browser push before admin logout.', error);
        }
      }
      const response = await fetch(apiUrl('/auth/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) throw new AdminApiError(response.status);
    }
  } catch (error) {
    clearSession();
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(0);
  } finally {
    clearSession();
  }
}

export function registerPushDevice(input: {
  name: string;
  platform: 'web';
  clientApp: 'admin-web';
  installationId: string;
  token: string;
}): Promise<{ registered: true }> {
  return fetchJson('/account/push-devices', { method: 'PUT', body: input });
}

export function unregisterPushDevice(installationId: string): Promise<void> {
  return fetchJson(`/account/push-devices/${encodeURIComponent(installationId)}`, {
    method: 'DELETE',
  });
}
