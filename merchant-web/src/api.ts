import type {
  AuthSession,
  AuthTokens,
  EmailSignInInput,
  OtpChallengeResult,
  PinSignInInput,
  MerchantPortal,
  MerchantPortalQrCode,
  MerchantPortalTransaction,
  MerchantPortalTransactions,
  MerchantQrCode,
  VerifyOtpResult,
} from './types';

const API_URL = (import.meta.env.VITE_MORI_API_URL ?? '').replace(/\/+$/, '');
const SESSION_KEY = 'mori.merchant.session';

type BrowserSession = AuthTokens & { expiresAt: number };
let refreshInFlight: Promise<boolean> | null = null;
export type TransactionFilters = {
  from?: string;
  to?: string;
  search?: string;
  status?: string;
  type?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
};

export class MerchantApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MerchantApiError';
  }
}

function session(): BrowserSession | null {
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const value: BrowserSession = JSON.parse(raw);
    if (!value.accessToken || !value.refreshToken) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return value;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(tokens: AuthTokens | null): void {
  if (!tokens) {
    window.sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ ...tokens, expiresAt: Date.now() + tokens.expiresIn * 1000 }),
  );
}

function url(path: string, query?: Record<string, string | number | undefined>): string {
  if (!API_URL) throw new MerchantApiError(0, 'The Mori Pay API URL is not configured.');
  const target = new URL(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') target.searchParams.set(key, String(value));
  }
  return target.toString();
}

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const current = session();
  if (!current?.refreshToken) return false;
  refreshInFlight = (async () => {
    try {
      const response = await fetch(url('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        saveSession(null);
        return false;
      }
      saveSession((await response.json()) as AuthTokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    blob?: boolean;
    auth?: boolean;
    retry?: boolean;
  } = {},
): Promise<T> {
  const authenticated = options.auth !== false;
  const current = session();
  const headers: Record<string, string> = {
    Accept: options.blob ? 'text/csv' : 'application/json',
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated && current?.accessToken) {
    headers.Authorization = `Bearer ${current.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new MerchantApiError(0, 'Could not connect to Mori Pay. Check your connection.');
  }

  if (response.status === 401 && authenticated && current?.refreshToken && options.retry !== false) {
    if (await refreshSession()) return request<T>(path, { ...options, retry: false });
  }

  if (response.status === 204) return undefined as T;
  if (options.blob && response.ok) return (await response.blob()) as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Request failed (${response.status}).`;
    throw new MerchantApiError(response.status, message);
  }
  return payload as T;
}

export async function signIn(
  input:
    | { mode: 'password'; credentials: EmailSignInInput }
    | { mode: 'pin'; credentials: PinSignInInput },
): Promise<AuthSession> {
  const result = await request<AuthSession>(
    input.mode === 'password' ? '/auth/email/login' : '/auth/pin/login',
    {
    method: 'POST',
    body: input.credentials,
    auth: false,
    },
  );
  saveSession(result.tokens);
  return result;
}

export function requestPhoneOtp(phone: string): Promise<OtpChallengeResult> {
  return request<OtpChallengeResult>('/auth/otp/request', {
    method: 'POST',
    body: { phone },
    auth: false,
  });
}

export async function signInWithPhoneOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const result = await request<VerifyOtpResult>('/auth/otp/verify', {
    method: 'POST',
    body: { phone, code },
    auth: false,
  });
  if (!result.registrationRequired) saveSession(result.session.tokens);
  return result;
}

export async function signOut(): Promise<void> {
  const current = session();
  try {
    if (current) {
      await fetch(url('/auth/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
    }
  } finally {
    saveSession(null);
  }
}

export function hasSession(): boolean {
  return session() !== null;
}

export function getMerchantPortal(filters: Pick<TransactionFilters, 'from' | 'to'> = {}) {
  return request<MerchantPortal>('/merchants/portal', { query: filters });
}

export function listTransactions(filters: TransactionFilters = {}) {
  return request<MerchantPortalTransactions>('/merchants/portal/transactions', {
    query: filters,
  });
}

export function getTransaction(id: string) {
  return request<MerchantPortalTransaction>(
    `/merchants/portal/transactions/${encodeURIComponent(id)}`,
  );
}

export function listQrCodes() {
  return request<MerchantPortalQrCode[]>('/merchants/portal/qr');
}

export function exportTransactions(
  filters: Omit<TransactionFilters, 'page' | 'pageSize'>,
) {
  return request<Blob>('/merchants/portal/transactions/export.csv', {
    query: filters,
    blob: true,
  });
}

export function createStaticQr(expiresAt?: string) {
  return request<MerchantQrCode>('/merchants/qr/static', {
    method: 'POST',
    body: { expiresAt },
  });
}

export function createFixedQr(input: { amount: number; reusable: boolean; expiresAt?: string }) {
  return request<MerchantQrCode>('/merchants/qr/fixed', {
    method: 'POST',
    body: input,
  });
}

export function revokeQr(id: string) {
  return request<void>(`/merchants/qr/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
  });
}
