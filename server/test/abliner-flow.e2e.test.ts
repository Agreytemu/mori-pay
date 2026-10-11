import 'reflect-metadata';

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { AblinerClient } from '../src/abliner/abliner.client.js';
import { TokenService } from '../src/auth/token.service.js';
import { API_PREFIX } from '../src/common/constants.js';
import { LedgerService, SYSTEM_LEDGER_ACCOUNTS } from '../src/ledger/ledger.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SettlementService } from '../src/settlement/settlement.service.js';
import { LEDGER_ACCOUNT_AVAILABLE, type UserWithWallet } from '../src/wallet/wallet.mapper.js';

async function isDatabaseReachable(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return await new Promise<boolean>((resolve) => {
      const socket = net.connect(
        { host: parsed.hostname, port: Number(parsed.port || 5432) },
        () => {
          socket.end();
          resolve(true);
        },
      );
      socket.setTimeout(1500);
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

const databaseReachable = await isDatabaseReachable();
const suffix = Date.now().toString().slice(-8);
const PIN = '654321';

/** Deterministic stand-in for the real provider, so tests never hit the network. */
class FakeAblinerClient {
  verificationStatus: 'completed' | 'failed' | 'pending' = 'completed';
  private seq = 0;

  createDeposit(request: { method: string; amount: number }): Promise<unknown> {
    return Promise.resolve({
      id: `ABL-${request.method.toUpperCase()}-${++this.seq}-${suffix}`,
      type: 'deposit',
      flow: request.method === 'card' ? 'hosted_page' : 'push',
      status: 'pending',
      amount: request.amount,
      currency: 'TZS',
      method: request.method,
      payment_url:
        request.method === 'card' ? 'https://abliner.test/checkout' : null,
      reference: `ABLREF${this.seq}${suffix}`,
      customer_reference: null,
      message: 'Mobile money push sent.',
    });
  }

  createWithdrawal(request: { amount: number }): Promise<unknown> {
    return Promise.resolve({
      id: `ABL-PAY-${++this.seq}-${suffix}`,
      status: 'processing',
      amount: request.amount,
      currency: 'TZS',
    });
  }

  previewWithdrawal(_method: string, amount: number): Promise<unknown> {
    return Promise.resolve({
      amount_tzs: amount,
      fee_tzs: 0,
      total_debited_tzs: amount,
    });
  }

  lookupPhone(phone: string): Promise<unknown> {
    return Promise.resolve({ phone, name: 'NEEMA JOSEPH', network: 'vodacom' });
  }

  getTransaction(id: string): Promise<unknown> {
    return Promise.resolve({
      id,
      type: 'deposit',
      amount: 0,
      currency: 'TZS',
      status: this.verificationStatus,
      reference: id,
      customer_reference: null,
      created_at: new Date().toISOString(),
    });
  }

  findTransaction(query: {
    id?: string;
    customerReference?: string;
    idempotencyKey?: string;
  }): Promise<unknown> {
    const id = query.id ?? query.customerReference ?? query.idempotencyKey ?? '';
    return this.getTransaction(id);
  }
}

/**
 * Mints an access token bound to a real refresh-token session, because the auth
 * guard now rejects tokens whose `sid` has no active session row.
 */
async function createTestAccessToken(
  prisma: PrismaService,
  tokens: TokenService,
  userId: string,
): Promise<string> {
  const refresh = tokens.createRefreshToken();
  const session = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    },
  });
  return tokens.createAccessToken(userId, session.id).token;
}

describe(
  'Top-ups, withdrawals and webhooks (e2e)',
  { skip: databaseReachable ? false : 'Postgres not reachable' },
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ledger: LedgerService;
    let tokens: TokenService;
    let settlement: SettlementService;
    let fake: FakeAblinerClient;
    let user: UserWithWallet;
    let token: string;
    const phone = `255${suffix}1`;

    const balance = async (): Promise<number> => {
      const response = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return response.body.balance.available as number;
    };

    const latestTransaction = (type: string) =>
      prisma.transaction.findFirstOrThrow({
        where: { userId: user.id, type },
        orderBy: { createdAt: 'desc' },
      });

    const fireWebhook = (
      reference: string,
      type: 'deposit' | 'withdrawal',
      status: 'completed' | 'failed',
    ) =>
      request(app.getHttpServer())
        .post(`/${API_PREFIX}/webhooks/abliner`)
        .send({
          id: `evt_${reference}_${status}`,
          event:
            type === 'deposit'
              ? status === 'completed'
                ? 'transaction.completed'
                : 'transaction.failed'
              : status === 'completed'
                ? 'withdrawal.completed'
                : 'withdrawal.failed',
          created_at: new Date().toISOString(),
          data: {
            id: reference,
            type,
            method: 'mobile',
            amount: 0,
            currency: 'TZS',
            status,
            reference,
            customer_reference: null,
            provider_reference: null,
          },
        });

    before(async () => {
      fake = new FakeAblinerClient();

      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(AblinerClient)
        .useValue(fake)
        .compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix(API_PREFIX);
      await app.init();

      prisma = app.get(PrismaService);
      ledger = app.get(LedgerService);
      tokens = app.get(TokenService);
      settlement = app.get(SettlementService);

      user = await prisma.user.create({
        data: {
          phone,
          fullName: 'Neema Joseph',
          firstName: 'Neema',
          memberId: `MP${suffix}`,
          status: 'active',
          wallet: {
            create: {
              currency: 'TZS',
              accountNumber: `9${suffix}`,
              ledgerAccounts: {
                create: { kind: LEDGER_ACCOUNT_AVAILABLE, currency: 'TZS', balance: 0n },
              },
            },
          },
        },
        include: { wallet: { include: { ledgerAccounts: true } } },
      });
      token = await createTestAccessToken(prisma, tokens, user.id);

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/pin/set`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pin: PIN })
        .expect(200);

      const external = await ledger.getSystemAccount(SYSTEM_LEDGER_ACCOUNTS.external);
      const account = user.wallet?.ledgerAccounts.find(
        (candidate) => candidate.kind === LEDGER_ACCOUNT_AVAILABLE,
      );
      assert.ok(account);
      await ledger.post({
        reference: 'seed-funding',
        legs: [
          { ledgerAccountId: external.id, direction: 'debit', amount: 100_000n, allowNegative: true },
          { ledgerAccountId: account.id, direction: 'credit', amount: 100_000n },
        ],
      });
    });

    after(async () => {
      await app?.close();
    });

    it('initiates a mobile-money top-up and credits the wallet on webhook', async () => {
      const init = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/topups/mobile-money`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10_000, mobileNumber: phone, network: 'Mpesa' })
        .expect(200);

      assert.equal(init.body.transaction.status, 'pending');
      assert.equal(typeof init.body.instructions, 'string');

      const transaction = await latestTransaction('deposit');
      assert.equal(await balance(), 100_000);

      await fireWebhook(transaction.internalReference as string, 'deposit', 'completed').expect(200);
      assert.equal(await balance(), 110_000);

      const settled = await prisma.transaction.findUniqueOrThrow({
        where: { id: transaction.id },
      });
      assert.equal(settled.status, 'completed');
    });

    it('returns a checkout URL for card top-ups', async () => {
      const init = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/topups/card`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5_000, customerName: 'Neema Joseph', customerPhone: phone })
        .expect(200);

      assert.equal(init.body.checkoutUrl, 'https://abliner.test/checkout');
      assert.equal(init.body.transaction.status, 'pending');
    });

    it('ignores a duplicate webhook', async () => {
      const transaction = await latestTransaction('deposit');
      await fireWebhook(transaction.internalReference as string, 'deposit', 'completed').expect(200);
      assert.equal(await balance(), 110_000);
    });

    it('marks a failed top-up without crediting', async () => {
      fake.verificationStatus = 'failed';

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/topups/mobile-money`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5_000, mobileNumber: phone, network: 'Mpesa' })
        .expect(200);

      const transaction = await latestTransaction('deposit');
      await fireWebhook(transaction.internalReference as string, 'deposit', 'failed').expect(200);

      const settled = await prisma.transaction.findUniqueOrThrow({
        where: { id: transaction.id },
      });
      assert.equal(settled.status, 'failed');
      assert.equal(await balance(), 110_000);

      fake.verificationStatus = 'completed';
    });

    it('holds withdrawal funds, then settles on success', async () => {
      const withdrawal = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/withdrawals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 20_000, phoneNumber: phone, network: 'Mpesa', pin: PIN })
        .expect(201);

      assert.equal(withdrawal.body.transaction.status, 'processing');
      assert.equal(withdrawal.body.fee, 0);
      assert.equal(await balance(), 90_000);

      const transaction = await latestTransaction('withdrawal');
      await fireWebhook(transaction.internalReference as string, 'withdrawal', 'completed').expect(200);

      assert.equal(await balance(), 90_000);
      const clearing = await ledger.getSystemAccount(SYSTEM_LEDGER_ACCOUNTS.clearing);
      const clearingRow = await prisma.ledgerAccount.findUniqueOrThrow({
        where: { id: clearing.id },
      });
      assert.equal(clearingRow.balance, 0n);
    });

    it('reconciles a pending withdrawal on read', async () => {
      fake.verificationStatus = 'completed';

      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/withdrawals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10_000, phoneNumber: phone, network: 'Mpesa', pin: PIN })
        .expect(201);

      assert.equal(await balance(), 80_000);

      const read = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet/transactions/${created.body.transaction.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.equal(read.body.status, 'completed');
      assert.equal(await balance(), 80_000);
    });

    it('returns held funds when a payout fails', async () => {
      fake.verificationStatus = 'failed';

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/withdrawals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10_000, phoneNumber: phone, network: 'Mpesa', pin: PIN })
        .expect(201);
      assert.equal(await balance(), 70_000);

      const transaction = await latestTransaction('withdrawal');
      await fireWebhook(transaction.internalReference as string, 'withdrawal', 'failed').expect(200);

      assert.equal(await balance(), 80_000);
      fake.verificationStatus = 'completed';
    });

    it('quotes a withdrawal fee and looks up a recipient', async () => {
      const quote = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/withdrawals/preview?amount=50000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.equal(quote.body.amount, 50_000);
      assert.equal(typeof quote.body.total, 'number');

      const lookup = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/withdrawals/lookup?phone=${phone}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.equal(lookup.body.name, 'NEEMA JOSEPH');
    });

    it('rejects a withdrawal above the available balance', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/withdrawals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 1_000_000, phoneNumber: phone, network: 'Mpesa', pin: PIN })
        .expect(409);
    });

    it('settles a deposit exactly once under concurrent finalization', async () => {
      const before = await balance();

      const deposit = await prisma.transaction.create({
        data: {
          userId: user.id,
          reference: `CONC-${suffix}`,
          type: 'deposit',
          status: 'pending',
          category: 'topUp',
          channel: 'mobileMoney',
          direction: 'credit',
          amount: 7_000n,
          fee: 0n,
          total: 7_000n,
          counterparty: phone,
          provider: 'abliner',
          providerStatus: 'pending',
        },
      });

      await Promise.all([
        settlement.settleDeposit(deposit),
        settlement.settleDeposit(deposit),
        settlement.settleDeposit(deposit),
      ]);

      assert.equal(await balance(), before + 7_000);

      const settled = await prisma.transaction.findUniqueOrThrow({
        where: { id: deposit.id },
      });
      assert.equal(settled.status, 'completed');

      // A second round of finalization after terminal state is a no-op.
      await settlement.settleDeposit(settled);
      assert.equal(await balance(), before + 7_000);
    });
  },
);
