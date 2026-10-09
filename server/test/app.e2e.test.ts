import 'reflect-metadata';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { API_PREFIX } from '../src/common/constants.js';

describe('App (e2e)', () => {
  let app: INestApplication;

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

  it('GET /api/v1/health returns ok', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/health`)
      .expect(200);

    assert.equal(response.body.status, 'ok');
  });
});
