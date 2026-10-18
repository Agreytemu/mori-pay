import { BadRequestException, Injectable } from '@nestjs/common';

import type { PaymentMethodVisibility } from '@mori-pay/contracts';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const PAYMENT_PROVIDER_IDS = ['abliner', 'clickpesa'] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export type PaymentProviderSettings = {
  ablinerEnabled: boolean;
  clickpesaEnabled: boolean;
  primaryProvider: PaymentProviderId;
} & PaymentMethodVisibility;

export type PaymentProviderAvailability = {
  id: PaymentProviderId;
  name: string;
  configured: boolean;
  enabled: boolean;
  primary: boolean;
  services: Array<{
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'not_implemented';
    networks?: Array<{
      id: string;
      name: string;
      image: 'mpesa' | 'airtel' | 'mixx' | 'halopesa';
      status: 'active' | 'inactive';
    }>;
  }>;
};

export type PaymentProviderConfiguration = {
  primaryProvider: PaymentProviderId;
  paymentMethods: PaymentMethodVisibility;
  providers: PaymentProviderAvailability[];
};

const MOBILE_NETWORKS = [
  { id: 'mpesa', name: 'M-Pesa', image: 'mpesa' },
  { id: 'airtel-money', name: 'Airtel Money', image: 'airtel' },
  { id: 'mixx-by-yas', name: 'Mixx by Yas', image: 'mixx' },
  { id: 'halopesa', name: 'HaloPesa', image: 'halopesa' },
] as const;

const DEFAULT_SETTINGS: PaymentProviderSettings = {
  ablinerEnabled: true,
  clickpesaEnabled: false,
  primaryProvider: 'abliner',
  mobileMoneyEnabled: true,
  bankEnabled: true,
  cardEnabled: true,
};

@Injectable()
export class PaymentProviderSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async getSettings(): Promise<PaymentProviderSettings> {
    const stored = await this.prisma.paymentProviderSettings.findUnique({
      where: { id: 'payment-provider-settings' },
    });
    if (!stored) return { ...DEFAULT_SETTINGS };
    return {
      ablinerEnabled: stored.ablinerEnabled,
      clickpesaEnabled: stored.clickpesaEnabled,
      primaryProvider: this.isProviderId(stored.primaryProvider)
        ? stored.primaryProvider
        : DEFAULT_SETTINGS.primaryProvider,
      mobileMoneyEnabled: stored.mobileMoneyEnabled,
      bankEnabled: stored.bankEnabled,
      cardEnabled: stored.cardEnabled,
    };
  }

  async getPaymentMethodVisibility(): Promise<PaymentMethodVisibility> {
    const {
      mobileMoneyEnabled,
      bankEnabled,
      cardEnabled,
    } = await this.getSettings();
    return { mobileMoneyEnabled, bankEnabled, cardEnabled };
  }

  async assertPaymentMethodEnabled(
    kind: 'mobile-money' | 'bank' | 'card',
  ): Promise<void> {
    const settings = await this.getSettings();
    const enabled =
      kind === 'mobile-money'
        ? settings.mobileMoneyEnabled
        : kind === 'bank'
          ? settings.bankEnabled
          : settings.cardEnabled;
    if (!enabled) {
      throw new BadRequestException(
        `The administrator has disabled ${kind === 'mobile-money' ? 'mobile money' : kind} payment methods.`,
      );
    }
  }

  isConfigured(provider: PaymentProviderId): boolean {
    if (provider === 'abliner') {
      const abliner = this.config.abliner;
      return Boolean(abliner.baseUrl && abliner.apiKey && abliner.webhookSecret);
    }
    const clickpesa = this.config.clickpesa;
    return Boolean(
      clickpesa.baseUrl &&
        clickpesa.clientId &&
        clickpesa.apiKey &&
        clickpesa.checksumKey,
    );
  }

  async getConfiguration(): Promise<PaymentProviderConfiguration> {
    const settings = await this.getSettings();
    const providers: PaymentProviderAvailability[] = PAYMENT_PROVIDER_IDS.map(
      (id) => {
        const configured = this.isConfigured(id);
        const enabled =
          id === 'abliner'
            ? settings.ablinerEnabled
            : settings.clickpesaEnabled;
        const active = configured && enabled;
        const mobileMoneyCollection = {
          id: 'mobile_money_collection',
          name: 'Mobile-money collection',
          status: active ? 'active' as const : 'inactive' as const,
          networks: MOBILE_NETWORKS.map((network) => ({
            ...network,
            status: active ? 'active' as const : 'inactive' as const,
          })),
        };

        return {
          id,
          name: id === 'abliner' ? 'Abliner' : 'ClickPesa',
          configured,
          enabled,
          primary: settings.primaryProvider === id,
          services:
            id === 'abliner'
              ? [
                  mobileMoneyCollection,
                  {
                    id: 'card_collection',
                    name: 'Card collection',
                    status: active ? 'active' as const : 'inactive' as const,
                  },
                  {
                    id: 'mobile_money_payout',
                    name: 'Mobile-money payout',
                    status: active ? 'active' as const : 'inactive' as const,
                    networks: MOBILE_NETWORKS.map((network) => ({
                      ...network,
                      status: active ? 'active' as const : 'inactive' as const,
                    })),
                  },
                  {
                    id: 'bank_payout',
                    name: 'Bank payout',
                    status: 'not_implemented' as const,
                  },
                ]
              : [
                  mobileMoneyCollection,
                  {
                    id: 'mobile_money_payout',
                    name: 'Mobile-money payout',
                    status: active ? 'active' as const : 'inactive' as const,
                    networks: MOBILE_NETWORKS.map((network) => ({
                      ...network,
                      status: active ? 'active' as const : 'inactive' as const,
                    })),
                  },
                  {
                    id: 'bank_payout',
                    name: 'Bank payout',
                    status: active ? 'active' as const : 'inactive' as const,
                  },
                ],
        };
      },
    );
    return {
      primaryProvider: settings.primaryProvider,
      paymentMethods: {
        mobileMoneyEnabled: settings.mobileMoneyEnabled,
        bankEnabled: settings.bankEnabled,
        cardEnabled: settings.cardEnabled,
      },
      providers,
    };
  }

  async assertEnabled(provider: PaymentProviderId): Promise<void> {
    const settings = await this.getSettings();
    const enabled =
      provider === 'abliner'
        ? settings.ablinerEnabled
        : settings.clickpesaEnabled;
    if (!enabled) {
      throw new BadRequestException(
        `${provider === 'abliner' ? 'Abliner' : 'ClickPesa'} is disabled by the administrator.`,
      );
    }
    if (!this.isConfigured(provider)) {
      throw new BadRequestException(
        `${provider === 'abliner' ? 'Abliner' : 'ClickPesa'} is not configured.`,
      );
    }
  }

  private isProviderId(value: string): value is PaymentProviderId {
    return PAYMENT_PROVIDER_IDS.includes(value as PaymentProviderId);
  }
}
