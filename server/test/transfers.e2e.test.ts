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

async function createUserWithWallet(
  prisma: PrismaService,
  phone: string,
  fullName: string,
): Promise<UserWithWallet> {
  return prisma.user.create({
    data: {
      phone,
      fullName,
      firstName: fullName.split(' ')[0],
      memberId: `MP${suffix}${phone.slice(-2)}`,
      status: 'active',
      wallet: {
        create: {
          currency: 'TZS',
          accountNumber: `9${phone.slice(-9)}`,
          ledgerAccounts: {
            create: { kind: LEDGER_ACCOUNT_AVAILABLE, currency: 'TZS', balance: 0n },
          },
        },
      },
    },
    include: { wallet: { include: { ledgerAccounts: true } } },
  });
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
  'Transfers, requests and merchants (e2e)',
  { skip: databaseReachable ? false : 'Postgres not reachable' },
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ledger: LedgerService;
    let tokens: TokenService;
    let userA: UserWithWallet;
    let userB: UserWithWallet;
    let tokenA: string;
    let tokenB: string;

    const available = (user: UserWithWallet): string => {
      const account = user.wallet?.ledgerAccounts.find(
        (candidate) => candidate.kind === LEDGER_ACCOUNT_AVAILABLE,
      );
      assert.ok(account, 'expected an available ledger account');
      return account.id;
    };

    const balance = async (user: UserWithWallet): Promise<number> => {
      const token = await createTestAccessToken(prisma, tokens, user.id);
      const response = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return response.body.balance.available as number;
    };

    before(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix(API_PREFIX);
      await app.init();

      prisma = app.get(PrismaService);
      ledger = app.get(LedgerService);
      tokens = app.get(TokenService);

      userA = await createUserWithWallet(prisma, `2557${suffix}1`, 'Asha Mwangi');
      userB = await createUserWithWallet(prisma, `2557${suffix}2`, 'Bakari Salim');
      tokenA = await createTestAccessToken(prisma, tokens, userA.id);
      tokenB = await createTestAccessToken(prisma, tokens, userB.id);

      await prisma.merchant.createMany({
        data: [
          { name: 'Agrey Pharmacy', identifier: 'AGR-2401', category: 'Pharmacy' },
          { name: 'Mashujaa Market', identifier: 'MKT-1049', category: 'Retail' },
        ],
      });

      for (const [token] of [
        [tokenA],
        [tokenB],
      ] as const) {
        await request(app.getHttpServer())
          .post(`/${API_PREFIX}/auth/pin/set`)
          .set('Authorization', `Bearer ${token}`)
          .send({ pin: PIN })
          .expect(200);
      }

      const external = await ledger.getSystemAccount(SYSTEM_LEDGER_ACCOUNTS.external);
      await ledger.post({
        reference: 'seed-funding',
        legs: [
          { ledgerAccountId: external.id, direction: 'debit', amount: 100_000n, allowNegative: true },
          { ledgerAccountId: available(userA), direction: 'credit', amount: 100_000n },
        ],
      });
    });

    after(async () => {
      await app?.close();
    });

    it('resolves recipients and previews transfers', async () => {
      const found = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/transfers/recipient?phone=${userB.phone}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      assert.equal(found.body.found, true);
      assert.equal(found.body.fullName, userB.fullName);

      const missing = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/transfers/recipient?phone=255700000000`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      assert.equal(missing.body.found, false);

      const preview = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/transfers/preview`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientPhone: userB.phone, amount: 5000 })
        .expect(200);
      assert.equal(preview.body.amount, 5000);
      assert.equal(preview.body.fee, 0);
      assert.equal(preview.body.total, 5000);
    });

    it('sends money with PIN, moves both balances, and is idempotent', async () => {
      const send = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/transfers/send`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          recipientPhone: userB.phone,
          amount: 5000,
          pin: PIN,
          idempotencyKey: `idem-${suffix}-1`,
        })
        .expect(201);
      assert.equal(send.body.transaction.direction, 'debit');

      const replay = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/transfers/send`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          recipientPhone: userB.phone,
          amount: 5000,
          pin: PIN,
          idempotencyKey: `idem-${suffix}-1`,
        })
        .expect(201);
      assert.equal(replay.body.transaction.id, send.body.transaction.id);

      assert.equal(await balance(userA), 95_000);
      assert.equal(await balance(userB), 5_000);

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/transfers/send`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ recipientPhone: userB.phone, amount: 5000, pin: PIN })
        .expect(400);
    });

    it('rejects a wrong PIN', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/transfers/send`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientPhone: userB.phone, amount: 500, pin: '000000' })
        .expect(401);
    });

    it('creates, lists, pays and cancels requests', async () => {
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ payerPhone: userA.phone, amount: 2000, note: 'Lunch' })
        .expect(201);
      const requestId = created.body.request.id as string;
      assert.equal(created.body.request.status, 'pending');

      const listForA = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/requests`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      assert.equal(listForA.body.length, 1);
      assert.equal(listForA.body[0].direction, 'incoming');
      assert.equal(listForA.body[0].payerName, userA.fullName);

      const paid = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests/${requestId}/pay`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: PIN })
        .expect(200);
      assert.equal(paid.body.request.status, 'paid');

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests/${requestId}/pay`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: PIN })
        .expect(400);

      const cancelling = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ payerPhone: userA.phone, amount: 1500, note: 'Cancelled' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests/${cancelling.body.request.id}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(204);

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests/${cancelling.body.request.id}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(400);

      assert.equal(await balance(userA), 93_000);
      assert.equal(await balance(userB), 7_000);
    });

    it('lists merchants and records payments to the settlement account', async () => {
      const merchants = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/merchants`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      assert.equal(merchants.body.length, 2);
      assert.ok(merchants.body.some((m: { identifier: string }) => m.identifier === 'AGR-2401'));

      const payment = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/merchants/pay`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ merchantId: 'AGR-2401', amount: 3000, pin: PIN })
        .expect(200);
      assert.equal(payment.body.merchantName, 'Agrey Pharmacy');

      const settlement = await ledger.getSystemAccount(SYSTEM_LEDGER_ACCOUNTS.merchant);
      const account = await prisma.ledgerAccount.findUniqueOrThrow({
        where: { id: settlement.id },
      });
      assert.equal(account.balance, 3_000n);

      assert.equal(await balance(userA), 90_000);
    });

    it('claims a money request once under concurrent pay attempts', async () => {
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests`)
        .set('Authorization', ['Bearer', tokenA].join(' '))
        .send({ payerPhone: userA.phone, amount: 1_000, note: 'Concurrent pay' })
        .expect(201);
      const requestId = created.body.request.id as string;
      const before = await balance(userA);

      const attempts = await Promise.all([
        request(app.getHttpServer())
          .post(`/${API_PREFIX}/requests/${requestId}/pay`)
          .set('Authorization', ['Bearer', tokenA].join(' '))
          .send({ pin: PIN, idempotencyKey: `request-pay-${suffix}-a` }),
        request(app.getHttpServer())
          .post(`/${API_PREFIX}/requests/${requestId}/pay`)
          .set('Authorization', ['Bearer', tokenA].join(' '))
          .send({ pin: PIN, idempotencyKey: `request-pay-${suffix}-b` }),
      ]);

      assert.deepEqual(
        attempts.map((response) => response.status).sort(),
        [200, 400],
      );
      assert.equal(await balance(userA), before - 1_000);
      const paid = await prisma.moneyRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      assert.equal(paid.status, 'paid');
    });

    it('scopes matching idempotency keys to different users', async () => {
      const key = `shared-${suffix}`;
      const requestForA = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests`)
        .set('Authorization', ['Bearer', tokenA].join(' '))
        .send({ payerPhone: userA.phone, amount: 500, note: 'Scoped key A' })
        .expect(201);
      const paymentByA = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests/${requestForA.body.request.id}/pay`)
        .set('Authorization', ['Bearer', tokenA].join(' '))
        .send({ pin: PIN, idempotencyKey: key })
        .expect(200);

      const requestForB = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests`)
        .set('Authorization', ['Bearer', tokenA].join(' '))
        .send({ payerPhone: userB.phone, amount: 500, note: 'Scoped key B' })
        .expect(201);
      const paymentByB = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/requests/${requestForB.body.request.id}/pay`)
        .set('Authorization', ['Bearer', tokenB].join(' '))
        .send({ pin: PIN, idempotencyKey: key })
        .expect(200);

      assert.notEqual(
        paymentByA.body.transaction.id,
        paymentByB.body.transaction.id,
      );
    });
  },
);