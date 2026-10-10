import { Injectable, Logger } from '@nestjs/common';

import type {
  StakabaCardPaymentRequest,
  StakabaCardPaymentResponse,
  StakabaCollectionRequest,
  StakabaCollectionResponse,
  StakabaPayoutRequest,
  StakabaPayoutResponse,
  StakabaTransactionVerification,
} from '@mori-pay/contracts';

import { ProviderError } from '../common/errors.js';
import { AppConfigService } from '../config/app-config.service.js';

const REQUEST_TIMEOUT_MS = 15_000;

type ErrorPayload = { error?: string; message?: string };

/**
 * Thin HTTP client for Stakaba (https://docs.stakaba.com). Auth is a static
 * `x-api-key` header; all amounts are whole TZS. Transient (5xx) failures are
 * surfaced as `ProviderError` so callers can retry or fail the operation.
 */
@Injectable()
export class StakabaClient {
  private readonly logger = new Logger(StakabaClient.name);

  constructor(private readonly config: AppConfigService) {}

  createCollection(
    request: StakabaCollectionRequest,
  ): Promise<StakabaCollectionResponse> {
    return this.request<StakabaCollectionResponse>(
      'POST',
      '/api/v1/payments/collection',
      request,
    );
  }

  createCardPayment(
    request: StakabaCardPaymentRequest,
  ): Promise<StakabaCardPaymentResponse> {
    return this.request<StakabaCardPaymentResponse>(
      'POST',
      '/api/v1/payments/card',
      request,
    );
  }

  createPayout(request: StakabaPayoutRequest): Promise<StakabaPayoutResponse> {
    return this.request<StakabaPayoutResponse>(
      'POST',
      '/api/v1/disbursements',
      request,
    );
  }

  getTransaction(
    internalReference: string,
  ): Promise<StakabaTransactionVerification> {
    return this.request<StakabaTransactionVerification>(
      'GET',
      `/api/v1/transactions/${encodeURIComponent(internalReference)}`,
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.stakaba.baseUrl.replace(/\/$/, '')}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-api-key': this.config.stakaba.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.error(
        `Stakaba ${method} ${path} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ProviderError('Unable to reach the payment provider');
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
      const message =
        (payload as ErrorPayload | undefined)?.message ??
        `Payment provider returned ${response.status}`;
      this.logger.error(`Stakaba ${method} ${path} -> ${response.status}: ${message}`);
      throw new ProviderError(message);
    }

    if (payload === undefined) {
      throw new ProviderError('Payment provider returned an empty response');
    }

    return payload as T;
  }
}
