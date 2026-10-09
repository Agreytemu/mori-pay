import 'reflect-metadata';

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { API_PREFIX } from '../src/common/constants.js';

async function isDatabaseReachable(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = Number(parsed.port || 5432);

    return await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port }, () => {
        socket.end();
        resolve(true);
      });
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

describe(
  'Auth (e2e)',
  { skip: databaseReachable ? false : 'Postgres not reachable' },
  () => {
    let app: INestApplication;
    const phone = `2557${Date.now().toString().slice(-8)}`;

    before(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix(API_PREFIX);
      await app.init();
    });

    after(async () => {
      await app?.close();
    });

    it('runs the full login/registration/PIN flow', async () => {
      const server = app.getHttpServer();

      const otp = await request(server)
        .post(`/${API_PREFIX}/auth/otp/request`)
        .send({ phone })
        .expect(200);

      assert.equal(typeof otp.body.devCode, 'string');

      const verified = await request(server)
        .post(`/${API_PREFIX}/auth/otp/verify`)
        .send({ phone, code: otp.body.devCode })
        .expect(200);

      assert.equal(verified.body.registrationRequired, true);

      const registered = await request(server)
        .post(`/${API_PREFIX}/auth/register`)
        .send({
          setupToken: verified.body.setupToken,
          fullName: 'Amina Juma',
          firstName: 'Amina',
        })
        .expect(201);

      const accessToken = registered.body.tokens.accessToken as string;
      assert.ok(accessToken);

      const me = await request(server)
        .get(`/${API_PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      assert.equal(me.body.user.phoneNumber, phone);

      await request(server)
        .post(`/${API_PREFIX}/auth/pin/set`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pin: '123456' })
        .expect(200);

      await request(server)
        .post(`/${API_PREFIX}/auth/pin/verify`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pin: '123456' })
        .expect(200);

      await request(server)
        .post(`/${API_PREFIX}/auth/pin/verify`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pin: '000000' })
        .expect(401);
    });

    it('protects private routes and keeps health public', async () => {
      const server = app.getHttpServer();
      await request(server).get(`/${API_PREFIX}/auth/me`).expect(401);
      await request(server).get(`/${API_PREFIX}/health`).expect(200);
    });
  },
);
