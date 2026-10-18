import { Injectable, Logger } from '@nestjs/common';

import { ProviderError } from '../common/errors.js';
import { AppConfigService } from '../config/app-config.service.js';
import type {
  ClickPesaBank,
  ClickPesaPayment,
  ClickPesaPayout,
  ClickPesaPayoutPreview,
  ClickPesaUssdPushPreview,
} from './clickpesa.types.js';

const REQUEST_TIMEOUT_MS = 20_000;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;
const TOKEN_LIFETIME_MS = 60 * 60_000;

type TokenResponse = { success: true; token: string };

export class ClickPesaProviderError extends ProviderError {
  constructor(
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super('The payment provider could not complete this request. Please try again.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPayment(value: unknown): value is ClickPesaPayment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.orderReference === 'string' &&
    typeof value.status === 'string' &&
    ['SUCCESS', 'SETTLED', 'PROCESSING', 'PENDING', 'FAILED'].includes(
      value.status,
    )
  );
}

const PAYOUT_STATUSES = [
  'AUTHORIZED',
  'PROCESSING',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
  'REVERSED',
] as const;

function payoutRecord(value: unknown): ClickPesaPayout | null {
  if (!isRecord(value)) return null;
  const order = isRecord(value.order) ? value.order : value;
  const orderReference =
    typeof order.orderReference === 'string'
      ? order.orderReference
      : typeof value.orderReference === 'string'
        ? value.orderReference
        : undefined;
  const statusValue = order.status ?? value.status;
  if (
    !orderReference ||
    typeof statusValue !== 'string' ||
    !PAYOUT_STATUSES.includes(statusValue as (typeof PAYOUT_STATUSES)[number])
  ) {
    return null;
  }
  const receiverValue = order.receiver ?? value.receiver ?? order.beneficiary ?? value.beneficiary;
  const receiver = isRecord(receiverValue)
    ? {
        ...(typeof receiverValue.accountName === 'string'
          ? { accountName: receiverValue.accountName }
          : {}),
        ...(typeof receiverValue.accountNumber === 'string'
          ? { accountNumber: receiverValue.accountNumber }
          : {}),
        ...(typeof receiverValue.accountProvider === 'string'
          ? { accountProvider: receiverValue.accountProvider }
          : {}),
      }
    : undefined;
  return {
    id:
      (typeof value.id === 'string' && value.id) ||
      (typeof order.id === 'string' && order.id) ||
      orderReference,
    orderReference,
    status: statusValue as ClickPesaPayout['status'],
    ...(typeof order.amount === 'string' || typeof order.amount === 'number'
      ? { amount: order.amount }
      : typeof value.amount === 'string' || typeof value.amount === 'number'
        ? { amount: value.amount }
        : {}),
    ...(typeof order.currency === 'string'
      ? { currency: order.currency }
      : typeof value.currency === 'string'
        ? { currency: value.currency }
        : {}),
    ...(typeof value.channel === 'string' ? { channel: value.channel } : {}),
    ...(typeof value.channelProvider === 'string'
      ? { channelProvider: value.channelProvider }
      : {}),
    ...(typeof value.fee === 'string' || typeof value.fee === 'number'
      ? { fee: value.fee }
      : {}),
    ...(receiver ? { receiver } : {}),
  };
}

@Injectable()
export class ClickPesaClient {
  private readonly logger = new Logger(ClickPesaClient.name);
  private token?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;

  constructor(private readonly config: AppConfigService) {}

  async previewUssdPush(request: {
    amount: number;
    currency: 'TZS';
    orderReference: string;
    phoneNumber: string;
  }): Promise<ClickPesaUssdPushPreview> {
    const result = await this.request(
      'POST',
      '/payments/preview-ussd-push-request',
      {
        amount: String(request.amount),
        currency: request.currency,
        orderReference: request.orderReference,
        phoneNumber: request.phoneNumber,
      },
    );
    if (
      !isRecord(result) ||
      !Array.isArray(result.activeMethods) ||
      !result.activeMethods.every(
        (method) =>
          isRecord(method) &&
          typeof method.name === 'string' &&
          (method.status === 'AVAILABLE' || method.status === 'UNAVAILABLE'),
      )
    ) {
      throw new ClickPesaProviderError(false);
    }
    return result as ClickPesaUssdPushPreview;
  }

  async initiateUssdPush(request: {
    amount: number;
    currency: 'TZS';
    orderReference: string;
    phoneNumber: string;
  }): Promise<ClickPesaPayment> {
    const result = await this.request(
      'POST',
      '/payments/initiate-ussd-push-request',
      {
        amount: String(request.amount),
        currency: request.currency,
        orderReference: request.orderReference,
        phoneNumber: request.phoneNumber,
      },
    );
    if (!isPayment(result)) throw new ClickPesaProviderError(false);
    return result;
  }

  async getPayment(orderReference: string): Promise<ClickPesaPayment | null> {
    const result = await this.request(
      'GET',
      `/payments/${encodeURIComponent(orderReference)}`,
    );
    if (!Array.isArray(result)) throw new ClickPesaProviderError(false);
    const payment = result.find(
      (item): item is ClickPesaPayment =>
        isPayment(item) && item.orderReference === orderReference,
    );
    if (!payment) return null;
    return payment;
  }

  async listBanks(): Promise<ClickPesaBank[]> {
    const result = await this.request('GET', '/list/banks');
    const banks = isRecord(result) && Array.isArray(result.banks)
      ? result.banks
      : result;
    if (!Array.isArray(banks)) throw new ClickPesaProviderError(false);
    const parsed: ClickPesaBank[] = [];
    for (const bank of banks) {
      const name =
        isRecord(bank) && typeof bank.name === 'string'
          ? bank.name
          : isRecord(bank) && typeof bank.bankName === 'string'
            ? bank.bankName
            : undefined;
      if (
        !isRecord(bank) ||
        !name ||
        typeof bank.bic !== 'string'
      ) {
        throw new ClickPesaProviderError(false);
      }
      parsed.push({ name, bic: bank.bic });
    }
    return parsed;
  }

  async previewMobileMoneyPayout(request: {
    amount: number;
    currency: 'TZS';
    orderReference: string;
    phoneNumber: string;
  }): Promise<ClickPesaPayoutPreview> {
    const result = await this.request(
      'POST',
      '/payouts/preview-mobile-money-payout',
      {
        amount: request.amount,
        currency: request.currency,
        orderReference: request.orderReference,
        phoneNumber: request.phoneNumber,
      },
    );
    return this.parsePayoutPreview(result);
  }

  async createMobileMoneyPayout(request: {
    amount: number;
    currency: 'TZS';
    orderReference: string;
    phoneNumber: string;
  }): Promise<ClickPesaPayout> {
    const result = await this.request(
      'POST',
      '/payouts/create-mobile-money-payout',
      {
        amount: request.amount,
        currency: request.currency,
        orderReference: request.orderReference,
        phoneNumber: request.phoneNumber,
      },
      true,
    );
    const payout = payoutRecord(result);
    if (!payout || payout.orderReference !== request.orderReference) {
      throw new ClickPesaProviderError(true);
    }
    return payout;
  }

  async previewBankPayout(request: {
    amount: number;
    currency: 'TZS';
    orderReference: string;
    accountNumber: string;
    bic: string;
    accountCurrency: 'TZS';
  }): Promise<ClickPesaPayoutPreview> {
    const result = await this.request(
      'POST',
      '/payouts/preview-bank-payout',
      {
        amount: request.amount,
        currency: request.currency,
        orderReference: request.orderReference,
        accountNumber: request.accountNumber,
        bic: request.bic,
        accountCurrency: request.accountCurrency,
      },
    );
    return this.parsePayoutPreview(result);
  }

  async createBankPayout(request: {
    amount: number;
    currency: 'TZS';
    orderReference: string;
    accountNumber: string;
    accountName: string;
    bic: string;
    accountCurrency: 'TZS';
  }): Promise<ClickPesaPayout> {
    const result = await this.request(
      'POST',
      '/payouts/create-bank-payout',
      {
        amount: request.amount,
        currency: request.currency,
        orderReference: request.orderReference,
        accountNumber: request.accountNumber,
        accountName: request.accountName,
        bic: request.bic,
        accountCurrency: request.accountCurrency,
      },
      true,
    );
    const payout = payoutRecord(result);
    if (!payout || payout.orderReference !== request.orderReference) {
      throw new ClickPesaProviderError(true);
    }
    return payout;
  }

  async getPayout(orderReference: string): Promise<ClickPesaPayout | null> {
    let result: unknown;
    try {
      result = await this.request(
        'GET',
        `/payouts/${encodeURIComponent(orderReference)}`,
      );
    } catch (error) {
      if (
        error instanceof ClickPesaProviderError &&
        error.statusCode === 404
      ) {
        return null;
      }
      throw error;
    }
    const items = Array.isArray(result)
      ? result
      : isRecord(result) && Array.isArray(result.payouts)
        ? result.payouts
        : [result];
    const payout = items
      .map(payoutRecord)
      .find(
        (item): item is ClickPesaPayout =>
          item !== null && item.orderReference === orderReference,
      );
    return payout ?? null;
  }

  private parsePayoutPreview(value: unknown): ClickPesaPayoutPreview {
    if (!isRecord(value)) throw new ClickPesaProviderError(false);
    const order = isRecord(value.order) ? value.order : value;
    const receiver = isRecord(value.receiver)
      ? value.receiver
      : isRecord(value.beneficiary)
        ? value.beneficiary
        : isRecord(order.receiver)
          ? order.receiver
          : undefined;
    return {
      ...(receiver && typeof receiver.accountName === 'string'
        ? { recipientName: receiver.accountName }
        : {}),
      ...(typeof value.fee === 'string' || typeof value.fee === 'number'
        ? { fee: value.fee }
        : {}),
      ...(typeof value.balance === 'string' || typeof value.balance === 'number'
        ? { balance: value.balance }
        : {}),
      ...(typeof value.channelProvider === 'string'
        ? { channelProvider: value.channelProvider }
        : {}),
    };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, string | number>,
    emptySuccessIsUncertain = false,
  ): Promise<unknown> {
    const baseUrl = this.config.clickpesa.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}${path}`;
    const rawBody = body ? JSON.stringify(body) : undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.authorizationToken(attempt === 1);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers: {
            accept: 'application/json',
            ...(rawBody ? { 'content-type': 'application/json' } : {}),
            authorization: token,
          },
          ...(rawBody ? { body: rawBody } : {}),
          signal: controller.signal,
        });
      } catch {
        this.logger.error(`ClickPesa ${method} ${path} unreachable`);
        throw new ClickPesaProviderError(true);
      } finally {
        clearTimeout(timeout);
      }

      if (response.status === 401 && attempt === 0) {
        this.token = undefined;
        continue;
      }

      const text = await response.text();
      let payload: unknown;
      try {
        payload = text ? JSON.parse(text) : undefined;
      } catch {
        payload = undefined;
      }
      if (!response.ok) {
        this.logger.error(
          `ClickPesa ${method} ${path} returned HTTP ${response.status}`,
        );
        throw new ClickPesaProviderError(
          response.status === 429 || response.status >= 500,
          response.status,
        );
      }
      if (payload === undefined) {
        throw new ClickPesaProviderError(emptySuccessIsUncertain);
      }
      return payload;
    }

    throw new ClickPesaProviderError(false, 401);
  }

  private async authorizationToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }
    if (!this.tokenRequest) {
      this.tokenRequest = this.generateToken();
    }
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async generateToken(): Promise<string> {
    const { baseUrl, clientId, apiKey } = this.config.clickpesa;
    if (!clientId || !apiKey) {
      this.logger.error('ClickPesa credentials are not configured');
      throw new ClickPesaProviderError(false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/generate-token`,
        {
          method: 'POST',
          headers: { 'client-id': clientId, 'api-key': apiKey },
          signal: controller.signal,
        },
      );
    } catch {
      this.logger.error('ClickPesa token endpoint unreachable');
      throw new ClickPesaProviderError(true);
    } finally {
      clearTimeout(timeout);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    if (
      !response.ok ||
      !isRecord(payload) ||
      payload.success !== true ||
      typeof payload.token !== 'string' ||
      payload.token.length === 0
    ) {
      this.logger.error(
        `ClickPesa token request returned HTTP ${response.status}`,
      );
      throw new ClickPesaProviderError(
        response.status === 429 || response.status >= 500,
        response.status,
      );
    }

    const token = (payload as TokenResponse).token;
    this.token = {
      value: token,
      expiresAt: Date.now() + TOKEN_LIFETIME_MS - TOKEN_REFRESH_MARGIN_MS,
    };
    return token;
  }
}
