import 'reflect-metadata';

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { API_PREFIX } from '../src/common/constants.js';
import { EmailService } from '../src/auth/email.service.js';
import { SMS_PROVIDER } from '../src/sms/sms.provider.js';

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
      })
        .overrideProvider(EmailService)
        .useValue({ sendCode: async () => undefined })
        .overrideProvider(SMS_PROVIDER)
        .useValue({ send: async () => undefined })
        .compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix(API_PREFIX);
      await app.init();
    });

    after(async () => {
      await app?.close();
    });

    it('runs the legacy OTP registration and payment PIN flow', async () => {
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
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(200);
      assert.equal(me.body.user.phoneNumber, phone);

      await request(server)
        .post(`/${API_PREFIX}/auth/pin/set`)
        .set('Authorization', 'Bearer ' + accessToken)
        .send({ pin: '123456' })
        .expect(200);

      await request(server)
        .post(`/${API_PREFIX}/auth/pin/verify`)
        .set('Authorization', 'Bearer ' + accessToken)
        .send({ pin: '123456' })
        .expect(200);

      await request(server)
        .post(`/${API_PREFIX}/auth/pin/verify`)
        .set('Authorization', 'Bearer ' + accessToken)
        .send({ pin: '000000' })
        .expect(401);
    });

    it('registers and signs in with verified email, password, and PIN', async () => {
      const server = app.getHttpServer();
      const email = `auth-${Date.now()}@example.test`;
      const password = 'first-password-123';

      const registration = await request(server)
        .post(`/${API_PREFIX}/auth/email/register`)
        .send({
          fullName: 'Amina Juma',
          firstName: 'Amina',
          email: email.toUpperCase(),
          password,
        })
        .expect(201);
      assert.equal(typeof registration.body.devCode, 'string');

      const verified = await request(server)
        .post(`/${API_PREFIX}/auth/email/verify`)
        .send({ email, code: registration.body.devCode })
        .expect(200);
      assert.equal(verified.body.user.email, email);
      assert.equal(verified.body.user.phoneNumber, null);
      assert.equal(verified.body.user.emailVerified, true);
      assert.equal(verified.body.user.hasPassword, true);

      const accessToken = verified.body.tokens.accessToken as string;
      const refreshToken = verified.body.tokens.refreshToken as string;
      await request(server)
        .post(`/${API_PREFIX}/auth/pin/set`)
        .set('Authorization', 'Bearer ' + accessToken)
        .send({ pin: '246810' })
        .expect(200);

      await request(server)
        .post(`/${API_PREFIX}/auth/email/login`)
        .send({ email, password })
        .expect(200);

      await request(server)
        .post(`/${API_PREFIX}/auth/pin/login`)
        .send({ email: email.toUpperCase(), pin: '246810' })
        .expect(200);

      const reset = await request(server)
        .post(`/${API_PREFIX}/auth/password/reset/request`)
        .send({ email })
        .expect(200);
      assert.equal(typeof reset.body.devCode, 'string');

      await request(server)
        .post(`/${API_PREFIX}/auth/password/reset`)
        .send({
          email,
          code: reset.body.devCode,
          password: 'second-password-456',
        })
        .expect(204);

      await request(server)
        .post(`/${API_PREFIX}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);

      const signedIn = await request(server)
        .post(`/${API_PREFIX}/auth/email/login`)
        .send({ email, password: 'second-password-456' })
        .expect(200);

      const linkedPhone = `2556${Date.now().toString().slice(-8)}`;
      const linkChallenge = await request(server)
        .post(`/${API_PREFIX}/auth/phone/request-link`)
        .set('Authorization', 'Bearer ' + signedIn.body.tokens.accessToken)
        .send({ phone: linkedPhone })
        .expect(200);
      assert.equal(typeof linkChallenge.body.devCode, 'string');

      await request(server)
        .post(`/${API_PREFIX}/auth/phone/verify-link`)
        .set('Authorization', 'Bearer ' + signedIn.body.tokens.accessToken)
        .send({ phone: linkedPhone, code: linkChallenge.body.devCode })
        .expect(200);

      const linkedMe = await request(server)
        .get(`/${API_PREFIX}/auth/me`)
        .set('Authorization', 'Bearer ' + signedIn.body.tokens.accessToken)
        .expect(200);
      assert.equal(linkedMe.body.user.phoneNumber, linkedPhone);

      await request(server)
        .post(`/${API_PREFIX}/auth/email/login`)
        .send({ email, password })
        .expect(401);
    });

    it('protects private routes and keeps health public', async () => {
      const server = app.getHttpServer();
      await request(server).get(`/${API_PREFIX}/auth/me`).expect(401);
      await request(server).get(`/${API_PREFIX}/health`).expect(200);
    });
  },
);
