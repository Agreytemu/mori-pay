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
};

/** Provider failure enriched with Abliner's stable machine-readable `code`. */
export class AblinerProviderError extends ProviderError {
  constructor(
    message: string,
    readonly providerCode?: string,
    readonly retryable = false,
  ) {
    super(message);
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
    request: AblinerWithdrawalRequest,
  ): Promise<AblinerWithdrawalData> {
    return this.data<AblinerWithdrawalData>('POST', '/api/v1/withdrawals', {
      body: {
        amount: request.amount,
        method: request.method,
        currency: request.currency,
        recipient: request.recipient,
        reference: request.reference,
      },
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
    const rows = await this.data<AblinerTransaction[]>(
      'GET',
      '/api/v1/transactions',
      { query: { id } },
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
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
      options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${this.config.abliner.apiKey}`,
    };
    if (options.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }
    if (options.signed) {
      if (!rawBody) throw new ProviderError('Signed request is missing a body');
      const secret = this.config.abliner.webhookSecret;
      if (!secret) {
        throw new ProviderError(
          'ABLINER_WEBHOOK_SECRET is required to sign deposit requests',
        );
      }
      const timestamp = Math.floor(Date.now() / 1000).toString();
      headers['x-abliner-timestamp'] = timestamp;
      headers['x-abliner-signature'] = createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
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
      this.logger.error(
        `Abliner ${method} ${path} unreachable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new AblinerProviderError('Unable to reach the payment provider', undefined, true);
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
      const error = payload as ErrorPayload | undefined;
      const message =
        error?.message ?? `Payment provider returned ${response.status}`;
      this.logger.error(
        `Abliner ${method} ${path} -> ${response.status} ${error?.code ?? ''}: ${message}`,
      );
      throw new AblinerProviderError(
        message,
        error?.code,
        error?.retryable ?? response.status >= 500,
      );
    }

    if (payload === undefined) {
      throw new AblinerProviderError('Payment provider returned an empty response');
    }

    return payload as T;
  }
}
