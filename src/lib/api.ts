import Constants from 'expo-constants';

import type { ApiErrorBody, ApiErrorCode, AuthTokens } from '@mori-pay/contracts';

import { storage } from './storage';

/**
 * Minimal fetch wrapper for the Mori Pay API.
 *
 * Responsibilities:
 *  - Resolve the base URL (env var > app.json `extra.apiUrl` > localhost dev).
 *  - Attach the bearer access token when the call is authenticated.
 *  - Transparently refresh the access token once on a 401 and replay.
 *  - Normalise every failure into an `ApiError` carrying the shared
 *    `{ error, message, details }` envelope from the server.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  extra.apiUrl ??
  'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

const ACCESS_KEY = 'mori.accessToken';
const REFRESH_KEY = 'mori.refreshToken';
const EXPIRES_KEY = 'mori.expiresAt';

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

let stored: StoredTokens | null = null;
let hydrated = false;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error;
    this.details = body.details;
  }
}

/** Reads persisted tokens once, before the first request. */
export async function hydrateTokens(): Promise<StoredTokens | null> {
  if (hydrated) return stored;
  hydrated = true;

  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    storage.get(ACCESS_KEY),
    storage.get(REFRESH_KEY),
    storage.get(EXPIRES_KEY),
  ]);

  if (accessToken && refreshToken) {
    stored = {
      accessToken,
      refreshToken,
      expiresAt: expiresAt ? Number(expiresAt) : 0,
    };
  }
  return stored;
}

export async function persistTokens(tokens: AuthTokens | null): Promise<void> {
  if (!tokens) {
    stored = null;
    await Promise.all([
      storage.remove(ACCESS_KEY),
      storage.remove(REFRESH_KEY),
      storage.remove(EXPIRES_KEY),
    ]);
    return;
  }

  const next: StoredTokens = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  stored = next;
  await Promise.all([
    storage.set(ACCESS_KEY, next.accessToken),
    storage.set(REFRESH_KEY, next.refreshToken),
    storage.set(EXPIRES_KEY, String(next.expiresAt)),
  ]);
}

export function getRefreshToken(): string | null {
  return stored?.refreshToken ?? null;
}

export function hasTokens(): boolean {
  return stored !== null;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const base = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the bearer token. Defaults to `true`. */
  auth?: boolean;
  query?: Query;
  signal?: AbortSignal;
  /** Internal: prevents an endless refresh-and-retry loop. */
  retry?: boolean;
};

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = stored?.refreshToken;
  if (!refreshToken) return false;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        await persistTokens(null);
        return false;
      }
      const tokens = (await response.json()) as AuthTokens;
      await persistTokens(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function parseJson(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const envelope = payload as Partial<ApiErrorBody> | null;
  const body: ApiErrorBody = {
    error: envelope?.error ?? 'APP_ERROR',
    message:
      envelope?.message ??
      (typeof envelope === 'string'
        ? (envelope as string)
        : `Request failed with status ${status}`),
    ...(envelope?.details ? { details: envelope.details } : {}),
  };
  return new ApiError(status, body);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    query,
    signal,
    retry = true,
  } = options;

  await hydrateTokens();

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && stored?.accessToken) headers.Authorization = `Bearer ${stored.accessToken}`;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && auth && stored?.refreshToken && retry) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, { ...options, retry: false });
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return payload as T;
}

/** Best-effort logout call. Never throws. */
export async function callLogout(): Promise<void> {
  const refreshToken = stored?.refreshToken;
  if (!refreshToken) return;
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Ignore network failures on logout; local state is cleared regardless.
  }
}
