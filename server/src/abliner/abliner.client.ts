import { createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import type {
  AblinerApiResponse,
  AblinerBalance,
  AblinerDepositData,
  AblinerDepositRequest,
  AblinerLookupResult,
  AblinerTransaction,
  AblinerWithdrawalData,
  AblinerWithdrawalPreview,
  AblinerWithdrawalRequest,
} from '@mori-pay/contracts';

import { ProviderError } from '../common/errors.js';
import { AppConfigService } from '../config/app-config.service.js';

const REQUEST_TIMEOUT_MS = 20_000;

type ErrorPayload = {
  status?: string;
  code?: string;
  message?: string;
  retryable?: boolean;
  field?: string;
  transaction_id?: string;
  errors?: unknown;
};

const SAFE_VALIDATION_FIELDS = new Set([
  'amount',
  'method',
  'currency',
  'phone',
  'reference',
  'callback_url',
]);
const SENSITIVE_LABEL_VALUE =
  /\b(phone|mobile|recipient|customer|payer|account|reference|email|name|token|secret|api[_ -]?key|authorization|signature|card(?:holder)?|cvv|pin)\b(\s*[:=]\s*|\s+)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

type SafeValidationError = { field: string; message?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactProviderText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .slice(0, 500)
    .replace(/\b(?:tsl_(?:live|test)_|whsec_)[A-Za-z0-9_-]+\b/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .replace(SENSITIVE_LABEL_VALUE, '$1$2[redacted]')
    .replace(
      /\b(?:belongs to|registered to|owned by|for customer)\s+[^,.;]+/gi,
      '[redacted personal data]',
    )
    .replace(/\b[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})*\b/g, '[redacted name]')
    .replace(/(?:\+?\d[\s().-]*){8,}/g, '[redacted number]')
    .replace(/\b[a-f0-9]{64}\b/gi, '[redacted signature]')
    .trim();
  return text || undefined;
}

function safeValidationErrors(value: unknown): SafeValidationError[] {
  const result: SafeValidationError[] = [];
  const add = (field: unknown, message: unknown) => {
    if (
      typeof field !== 'string' ||
      !SAFE_VALIDATION_FIELDS.has(field) ||
      result.length >= 20
    ) {
      return;
    }
    const safeMessage = redactProviderText(message);
    result.push({ field, ...(safeMessage ? { message: safeMessage } : {}) });
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) continue;
      add(entry.field ?? entry.path ?? entry.name, entry.message ?? entry.detail);
    }
  } else if (isRecord(value)) {
    for (const [field, entry] of Object.entries(value)) {
      if (typeof entry === 'string') {
        add(field, entry);
      } else if (Array.isArray(entry)) {
        for (const message of entry) add(field, message);
      } else if (isRecord(entry)) {
        add(field, entry.message ?? entry.detail);
      }
    }
  }
  return result;
}

/** User-safe message per Abliner error code. Raw provider text never leaves. */
const SAFE_PROVIDER_MESSAGE: Record<string, string> = {
  insufficient_funds: 'You do not have enough funds for this transaction.',
  amount_out_of_range: 'That amount is outside the allowed range.',
  invalid_phone: 'That phone number was rejected. Check it and try again.',
  unsupported_request: 'This payment method is not available right now.',
  validation_failed: 'The payment details were rejected. Review them and try again.',
  name_not_found: 'We could not find that recipient.',
  not_found: 'We could not find that transaction.',
  unauthorized: 'The payment service is temporarily unavailable.',
  invalid_request_signature:
    'The payment service is temporarily unavailable.',
  webhook_secret_required:
    'The payment service is temporarily unavailable.',
  gateway_not_configured: 'This payment method is temporarily unavailable.',
  provider_error: 'The payment provider could not complete this request. Please try again.',
  internal_error: 'The payment provider could not complete this request. Please try again.',
};
const DEFAULT_PROVIDER_MESSAGE =
  'The payment could not be completed. Please try again.';

/**
 * Provider failure enriched with Abliner's stable machine-readable `code`.
 * The message shown to clients is always safe; diagnostic detail is redacted.
 */
export class AblinerProviderError extends ProviderError {
  constructor(
    readonly providerCode: string | undefined,
    readonly retryable = false,
    readonly detail?: string,
  ) {
    super(
      (providerCode && SAFE_PROVIDER_MESSAGE[providerCode]) ||
        DEFAULT_PROVIDER_MESSAGE,
    );
  }
}

type RequestOptions = {
  body?: unknown;
  idempotencyKey?: string;
  /** HMAC-sign the body with the webhook secret (required for deposits). */
  signed?: boolean;
  query?: Record<string, string | number | undefined>;
};

/**
 * Thin HTTP client for Abliner (https://abliner.net/docs). Auth is a static
 * Bearer key; amounts are whole TZS. `POST /deposits` is additionally signed
 * with HMAC-SHA256(`${timestamp}.${body}`) using the webhook secret and sent
 * with an `Idempotency-Key`.
 */
@Injectable()
export class AblinerClient {
  private readonly logger = new Logger(AblinerClient.name);

  constructor(private readonly config: AppConfigService) {}

  createDeposit(
    request: AblinerDepositRequest & { idempotencyKey: string },
  ): Promise<AblinerDepositData> {
    return this.data<AblinerDepositData>('POST', '/api/v1/deposits', {
      body: {
        amount: request.amount,
        method: request.method,
        currency: request.currency,
        ...(request.phone ? { phone: request.phone } : {}),
        reference: request.reference,
        ...(request.callbackUrl ? { callback_url: request.callbackUrl } : {}),
      },
      idempotencyKey: request.idempotencyKey,
      signed: true,
    });
  }

  createWithdrawal(
    request: AblinerWithdrawalRequest & { idempotencyKey?: string },
  ): Promise<AblinerWithdrawalData> {
    return this.data<AblinerWithdrawalData>('POST', '/api/v1/withdrawals', {
      body: {
        amount: request.amount,
        method: request.method,
        currency: request.currency,
        recipient: request.recipient,
        reference: request.reference,
        ...(this.config.abliner.callbackUrl
          ? { callback_url: this.config.abliner.callbackUrl }
          : {}),
      },
      idempotencyKey: request.idempotencyKey,
    });
  }

  previewWithdrawal(
    method: 'mobile' | 'bank',
    amount: number,
  ): Promise<AblinerWithdrawalPreview> {
    return this.data<AblinerWithdrawalPreview>(
      'GET',
      '/api/v1/withdrawals/preview',
      { query: { method, amount } },
    );
  }

  lookupPhone(phone: string): Promise<AblinerLookupResult> {
    return this.data<AblinerLookupResult>('GET', '/api/v1/lookup', {
      query: { phone },
    });
  }

  getBalance(): Promise<AblinerBalance> {
    return this.data<AblinerBalance>('GET', '/api/v1/balance');
  }

  async getTransaction(id: string): Promise<AblinerTransaction | null> {
    return this.findTransaction({ id });
  }

  /** Finds an exact transaction in Abliner's latest-transactions response. */
  async findTransaction(query: {
    id?: string;
    customerReference?: string;
    idempotencyKey?: string;
  }): Promise<AblinerTransaction | null> {
    if (!query.id && !query.customerReference && !query.idempotencyKey) {
      return null;
    }

    const params: Record<string, string | number | undefined> = {
      id: query.id,
      customer_reference: query.customerReference,
      idempotency_key: query.idempotencyKey,
      limit: 50,
    };

    const rows = await this.data<AblinerTransaction[]>(
      'GET',
      '/api/v1/transactions',
      { query: params },
    );
    if (!Array.isArray(rows)) return null;

    return (
      rows.find(
        (row) =>
          (query.id !== undefined && row.id === query.id) ||
          (query.customerReference !== undefined &&
            (row.customer_reference === query.customerReference ||
              row.reference === query.customerReference)) ||
          (query.idempotencyKey !== undefined &&
            row.idempotency_key === query.idempotencyKey),
      ) ?? null
    );
  }

  async sendSms(request: {
    recipient: string;
    message: string;
    senderId?: string;
  }): Promise<void> {
    await this.data<unknown>('POST', '/api/v1/sms/send', {
      body: {
        recipient: request.recipient,
        message: request.message,
        ...(request.senderId ? { sender_id: request.senderId } : {}),
      },
    });
  }

  private async data<T>(
    method: 'GET' | 'POST',
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const payload = await this.request<T | AblinerApiResponse<T>>(
      method,
      path,
      options,
    );
    if (
      payload &&
      typeof payload === 'object' &&
      'status' in payload &&
      (payload as AblinerApiResponse<T>).status === 'success'
    ) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const base = this.config.abliner.baseUrl.replace(/\/$/, '');
    const query = options.query
      ? `?${new URLSearchParams(
          Object.entries(options.query)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        ).toString()}`
      : '';
    const url = `${base}${path}${query}`;

    const rawBody =
      options.body !== undefined
        ? Buffer.from(JSON.stringify(options.body), 'utf8')
        : undefined;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${this.config.abliner.apiKey}`,
    };
    if (options.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }
    if (options.signed) {
      if (!rawBody || rawBody.byteLength === 0) {
        throw new ProviderError('The payment request could not be prepared.');
      }
      const secret = this.config.abliner.webhookSecret;
      if (!secret?.startsWith('whsec_')) {
        this.logger.error(
          'ABLINER_WEBHOOK_SECRET must be the Abliner webhook signing secret to sign deposit requests',
        );
        throw new ProviderError('The payment service is not configured.');
      }
      const timestamp = Math.floor(Date.now() / 1000).toString();
      headers['x-abliner-timestamp'] = timestamp;
      headers['x-abliner-signature'] = createHmac('sha256', secret)
        .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]))
        .digest('hex');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: rawBody,
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.error(`Abliner ${method} ${path} unreachable`);
      throw new AblinerProviderError(
        undefined,
        true,
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      const error = isRecord(payload) ? (payload as ErrorPayload) : undefined;
      const safeMessage = redactProviderText(error?.message);
      const providerCode =
        typeof error?.code === 'string' &&
        /^[a-z0-9_]{1,80}$/i.test(error.code)
          ? error.code
          : undefined;
      this.logger.error(
        JSON.stringify({
          provider: 'abliner',
          method,
          path,
          status: response.status,
          ...(providerCode ? { code: providerCode } : {}),
          ...(typeof error?.field === 'string' &&
          SAFE_VALIDATION_FIELDS.has(error.field)
            ? { field: error.field }
            : {}),
          ...(safeMessage ? { message: safeMessage } : {}),
          ...(response.status === 422
            ? { validationErrors: safeValidationErrors(error?.errors) }
            : {}),
        }),
      );
      throw new AblinerProviderError(
        providerCode,
        typeof error?.retryable === 'boolean'
          ? error.retryable
          : response.status >= 500,
        safeMessage ?? `Payment provider returned ${response.status}`,
      );
    }

    if (payload === undefined) {
      throw new AblinerProviderError(undefined, false, 'empty response');
    }

    return payload as T;
  }
}
