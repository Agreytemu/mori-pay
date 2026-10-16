/** Query keys whose values may contain PII or secrets; blanked before logging. */
export const SENSITIVE_QUERY_KEY =
  /(phone|mobile|recipient|token|pin|otp|secret|api[_-]?key|password|email)/i;

/** Replaces sensitive query values with `[redacted]` before they reach logs. */
export function scrubUrl(url: string): string {
  const questionMark = url.indexOf('?');
  if (questionMark === -1) return url;

  const path = url.slice(0, questionMark);
  const params = new URLSearchParams(url.slice(questionMark + 1));
  let touched = false;
  for (const key of params.keys()) {
    if (SENSITIVE_QUERY_KEY.test(key)) {
      params.set(key, '[redacted]');
      touched = true;
    }
  }
  if (!touched) return url;
  const scrubbed = params.toString();
  return scrubbed ? `${path}?${scrubbed}` : path;
}

/** Blanks sensitive keys on a parsed query/params object before logging. */
export function scrubQueryRecord(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  const scrubbed: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    scrubbed[key] = SENSITIVE_QUERY_KEY.test(key) ? '[redacted]' : entry;
  }
  return scrubbed;
}

/**
 * Keeps only the trailing characters of a phone number so a log line can never
 * be replayed as a recipient or matched against a customer list.
 */
export function maskPhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 3) return '[redacted]';
  return `${'*'.repeat(trimmed.length - 3)}${trimmed.slice(-3)}`;
}

type LoggedRequest = {
  id?: unknown;
  method?: unknown;
  url?: unknown;
  query?: unknown;
  params?: unknown;
  headers?: unknown;
  remoteAddress?: unknown;
  remotePort?: unknown;
};

/**
 * pino-http request serializer. It keeps the standard request fields but
 * scrubs PII from the logged URL, query, and route params, so endpoints that
 * take a recipient phone number as a query parameter never write it to logs.
 */
export function serializeRequest(
  request: LoggedRequest | null | undefined,
): Record<string, unknown> {
  if (!request || typeof request !== 'object') return {};
  return {
    ...(request.id === undefined ? {} : { id: request.id }),
    method: request.method,
    url: typeof request.url === 'string' ? scrubUrl(request.url) : request.url,
    ...(request.query === undefined
      ? {}
      : { query: scrubQueryRecord(request.query) }),
    ...(request.params === undefined
      ? {}
      : { params: scrubQueryRecord(request.params) }),
    ...(request.headers === undefined ? {} : { headers: request.headers }),
    remoteAddress: request.remoteAddress,
    remotePort: request.remotePort,
  };
}
