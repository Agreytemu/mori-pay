import 'reflect-metadata';

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { API_PREFIX } from '../src/common/constants.js';
import { InsufficientFundsError } from '../src/common/errors.js';
import { LedgerService, SYSTEM_LEDGER_ACCOUNTS } from '../src/ledger/ledger.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { LEDGER_ACCOUNT_AVAILABLE } from '../src/wallet/wallet.mapper.js';
import type { UserWithWallet } from '../src/wallet/wallet.mapper.js';

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

describe(
  'Wallet (e2e)',
  { skip: databaseReachable ? false : 'Postgres not reachable' },
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ledger: LedgerService;
    let tokens: TokenService;
    let userA: UserWithWallet;
    let userB: UserWithWallet;
    let accessTokenA: string;
    let accessTokenB: string;
    let transactionId: string;

    const availableAccountId = (user: UserWithWallet): string => {
      const account = user.wallet?.ledgerAccounts.find(
        (candidate) => candidate.kind === LEDGER_ACCOUNT_AVAILABLE,
      );
      assert.ok(account, 'expected an available ledger account');
      return account.id;
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
      accessTokenA = tokens.createAccessToken(userA.id, 'e2e-a').token;
      accessTokenB = tokens.createAccessToken(userB.id, 'e2e-b').token;

      const external = await ledger.getSystemAccount(SYSTEM_LEDGER_ACCOUNTS.external);
      await ledger.post({
        reference: 'seed-funding',
        legs: [
          { ledgerAccountId: external.id, direction: 'debit', amount: 10_000n, allowNegative: true },
          { ledgerAccountId: availableAccountId(userA), direction: 'credit', amount: 10_000n },
        ],
      });
    });

    after(async () => {
      await app?.close();
    });

    it('reports the wallet balance from the ledger', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(200);

      assert.equal(response.body.balance.available, 10_000);
      assert.equal(response.body.phoneNumber, userA.phone);
    });

    it('moves money with a balanced posting and is idempotent', async () => {
      const created = await prisma.transaction.create({
        data: {
          userId: userA.id,
          reference: `TX-${suffix}-1`,
          type: 'send',
          status: 'completed',
          category: 'person',
          channel: 'wallet',
          direction: 'debit',
          amount: 3_000n,
          total: 3_000n,
          counterparty: userB.fullName,
          counterpartyDetail: userB.phone,
        },
      });
      transactionId = created.id;

      const legs = [
        { ledgerAccountId: availableAccountId(userA), direction: 'debit' as const, amount: 3_000n },
        { ledgerAccountId: availableAccountId(userB), direction: 'credit' as const, amount: 3_000n },
      ];
      await ledger.post({ reference: created.reference, transactionId: created.id, legs });
      await ledger.post({ reference: created.reference, transactionId: created.id, legs });

      const walletA = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(200);
      assert.equal(walletA.body.balance.available, 7_000);

      const walletB = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet`)
        .set('Authorization', `Bearer ${accessTokenB}`)
        .expect(200);
      assert.equal(walletB.body.balance.available, 3_000);
    });

    it('rejects a debit that would overdraw an available account', async () => {
      await assert.rejects(
        () =>
          ledger.post({
            reference: `overdraft-${suffix}`,
            legs: [
              { ledgerAccountId: availableAccountId(userA), direction: 'debit', amount: 1_000_000n },
              { ledgerAccountId: availableAccountId(userB), direction: 'credit', amount: 1_000_000n },
            ],
          }),
        InsufficientFundsError,
      );
    });

    it('lists and filters transactions, and hides other users', async () => {
      const list = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet/transactions`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(200);

      assert.equal(list.body.items.length, 1);
      assert.equal(list.body.nextCursor, null);
      assert.equal(list.body.items[0].id, transactionId);
      assert.equal(list.body.items[0].direction, 'debit');

      const filtered = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet/transactions?type=payment`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(200);
      assert.equal(filtered.body.items.length, 0);

      const detail = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(200);
      assert.equal(detail.body.reference, `TX-${suffix}-1`);

      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessTokenB}`)
        .expect(404);
    });

    it('paginates with an opaque cursor', async () => {
      for (const n of [2, 3]) {
        await prisma.transaction.create({
          data: {
            userId: userB.id,
            reference: `TX-${suffix}-${n}`,
            type: 'receive',
            status: 'completed',
            category: 'person',
            channel: 'wallet',
            direction: 'credit',
            amount: BigInt(n * 100),
            total: BigInt(n * 100),
            counterparty: userA.fullName,
          },
        });
      }

      const first = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/wallet/transactions?limit=2`)
        .set('Authorization', `Bearer ${accessTokenB}`)
        .expect(200);
      assert.equal(first.body.items.length, 2);
      assert.ok(first.body.nextCursor);

      const second = await request(app.getHttpServer())
        .get(
          `/${API_PREFIX}/wallet/transactions?limit=2&cursor=${first.body.nextCursor}`,
        )
        .set('Authorization', `Bearer ${accessTokenB}`)
        .expect(200);
      assert.equal(second.body.items.length, 1);
      assert.equal(second.body.nextCursor, null);
    });
  },
);
