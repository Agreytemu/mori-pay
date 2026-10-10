import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from './config/config.module.js';
import { AccountModule } from './account/account.module.js';
import { validateEnv } from './config/env.validation.js';
import { AblinerModule } from './abliner/abliner.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { MerchantsModule } from './merchants/merchants.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RequestsModule } from './requests/requests.module.js';
import { SettlementModule } from './settlement/settlement.module.js';
import { TopUpsModule } from './topups/topups.module.js';
import { TransfersModule } from './transfers/transfers.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { WithdrawalsModule } from './withdrawals/withdrawals.module.js';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req, res) => {
          const header = req.headers['x-request-id'];
          const id =
            (Array.isArray(header) ? header[0] : header) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
        transport: isProduction
          ? undefined
          : {
              target: 'pino-pretty',
              options: { singleLine: true, colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
            },
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    AppConfigModule,
    AccountModule,
    PrismaModule,
    LedgerModule,
    PaymentsModule,
    SettlementModule,
    AblinerModule,
    AuthModule,
    WalletModule,
    TransfersModule,
    RequestsModule,
    MerchantsModule,
    TopUpsModule,
    WithdrawalsModule,
    WebhooksModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
