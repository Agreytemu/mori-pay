/** Shared API envelope and error contract (mirrors Stakaba's error shape). */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'APP_ERROR';

export type ApiErrorBody = {
  error: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

/** RFC-7807-ish success wrapper used by paginated and single-resource reads. */
export type ApiEnvelope<T> = {
  data: T;
};
