import 'reflect-metadata';

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { TokenService } from '../src/auth/token.service.js';
import { API_PREFIX } from '../src/common/constants.js';
import { LedgerService, SYSTEM_LEDGER_ACCOUNTS } from '../src/ledger/ledger.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StakabaClient } from '../src/stakaba/stakaba.client.js';
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
class FakeStakabaClient {
  verificationStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
  private seq = 0;

  createCollection(): Promise<{ internalReference: string }> {
    return Promise.resolve({ internalReference: `STK-COL-${++this.seq}-${suffix}` });
  }

  createCardPayment(): Promise<{ checkoutUrl: string; internalReference: string }> {
    return Promise.resolve({
      checkoutUrl: 'https://pay.stakaba.test/checkout',
      internalReference: `STK-CARD-${++this.seq}-${suffix}`,
    });
  }

  createPayout(request: { amount: number }): Promise<{
    disbursement: { id: string; status: string; amount: number; currency: string };
  }> {
    return Promise.resolve({
      disbursement: {
        id: `STK-PAY-${++this.seq}-${suffix}`,
        status: 'processing',
        amount: request.amount,
        currency: 'TZS',
      },
    });
  }

  getTransaction(internalReference: string): Promise<{
    internalReference: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    type: 'COLLECTION' | 'CARD' | 'PAYOUT';
    grossAmount: number;
    stakabaFee: number;
    netAmount: number;
  }> {
    return Promise.resolve({
      internalReference,
      status: this.verificationStatus,
      type: 'COLLECTION',
      grossAmount: 0,
      stakabaFee: 0,
      netAmount: 0,
    });
  }
}

describe(
  'Top-ups, withdrawals and webhooks (e2e)',
  { skip: databaseReachable ? false : 'Postgres not reachable' },
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ledger: LedgerService;
    let tokens: TokenService;
    let fake: FakeStakabaClient;
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

    const fireWebhook = (internalReference: string, type: 'COLLECTION' | 'PAYOUT') =>
      request(app.getHttpServer())
        .post(`/${API_PREFIX}/webhooks/stakaba`)
        .send({
          event: 'transaction.success',
          internalReference,
          status: 'SUCCESS',
          type,
          grossAmount: 0,
          stakabaFee: 0,
          netAmount: 0,
          currency: 'TZS',
          mobileNumber: phone,
          network: 'Mpesa',
          providerReference: internalReference,
        });

    before(async () => {
      fake = new FakeStakabaClient();

      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(StakabaClient)
        .useValue(fake)
        .compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix(API_PREFIX);
      await app.init();

      prisma = app.get(PrismaService);
      ledger = app.get(LedgerService);
      tokens = app.get(TokenService);

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
      token = tokens.createAccessToken(user.id, 'e2e').token;

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

      await fireWebhook(transaction.internalReference as string, 'COLLECTION').expect(200);
      assert.equal(await balance(), 110_000);

      const settled = await prisma.transaction.findUniqueOrThrow({
        where: { id: transaction.id },
      });
      assert.equal(settled.status, 'completed');
    });

    it('ignores a duplicate webhook', async () => {
      const transaction = await latestTransaction('deposit');
      await fireWebhook(transaction.internalReference as string, 'COLLECTION').expect(200);
      assert.equal(await balance(), 110_000);
    });

    it('marks a failed top-up without crediting', async () => {
      fake.verificationStatus = 'FAILED';

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/topups/mobile-money`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5_000, mobileNumber: phone, network: 'Mpesa' })
        .expect(200);

      const transaction = await latestTransaction('deposit');
      await fireWebhook(transaction.internalReference as string, 'COLLECTION').expect(200);

      const settled = await prisma.transaction.findUniqueOrThrow({
        where: { id: transaction.id },
      });
      assert.equal(settled.status, 'failed');
      assert.equal(await balance(), 110_000);

      fake.verificationStatus = 'SUCCESS';
    });

    it('holds withdrawal funds, then settles on success', async () => {
      const withdrawal = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/withdrawals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 20_000, phoneNumber: phone, network: 'Mpesa', pin: PIN })
        .expect(201);

      assert.equal(withdrawal.body.transaction.status, 'processing');
      assert.equal(await balance(), 90_000);

      const transaction = await latestTransaction('withdrawal');
      await fireWebhook(transaction.internalReference as string, 'PAYOUT').expect(200);

      assert.equal(await balance(), 90_000);
      const clearing = await ledger.getSystemAccount(SYSTEM_LEDGER_ACCOUNTS.clearing);
      const clearingRow = await prisma.ledgerAccount.findUniqueOrThrow({
        where: { id: clearing.id },
      });
      assert.equal(clearingRow.balance, 0n);
    });

    it('returns held funds when a payout fails', async () => {
      fake.verificationStatus = 'FAILED';

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/withdrawals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10_000, phoneNumber: phone, network: 'Mpesa', pin: PIN })
        .expect(201);
      assert.equal(await balance(), 80_000);

      const transaction = await latestTransaction('withdrawal');
      await fireWebhook(transaction.internalReference as string, 'PAYOUT').expect(200);

      assert.equal(await balance(), 90_000);
      fake.verificationStatus = 'SUCCESS';
    });

    it('rejects a withdrawal above the available balance', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/withdrawals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 1_000_000, phoneNumber: phone, network: 'Mpesa', pin: PIN })
        .expect(409);
    });
  },
);
