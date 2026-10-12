import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { describe, it } from 'node:test';

import { EmailService } from '../src/auth/email.service.js';
import { AppConfigService } from '../src/config/app-config.service.js';
import { validateEnv } from '../src/config/env.validation.js';

function createEmailService(smtpPort: number): EmailService {
  const env = validateEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/mori_pay',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'payments@example.com',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: smtpPort,
    SMTP_SECURE: 'false',
    SMTP_USER: 'smtp-user',
    SMTP_PASS: 'smtp-password',
  });
  return new EmailService(new AppConfigService(new ConfigService(env)));
}

describe('email delivery providers', () => {
  it('uses Resend first and returns when Resend accepts the email', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = async () => {
      requestCount += 1;
      return new Response(null, { status: 200 });
    };

    try {
      const email = createEmailService(1);
      await email.sendCode('recipient@example.com', '123456', 'verify', 300);
      assert.equal(requestCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falls back to SMTP when Resend returns a failure response', async () => {
    const smtpServer = createServer((socket) => {
      let buffer = '';
      let receivingMessage = false;
      socket.write('220 localhost ESMTP\r\n');
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          if (receivingMessage) {
            if (line === '.') {
              receivingMessage = false;
              socket.write('250 2.0.0 queued\r\n');
            }
          } else if (/^(EHLO|HELO)\b/i.test(line)) {
            socket.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
          } else if (/^AUTH\b/i.test(line)) {
            socket.write('235 2.7.0 authenticated\r\n');
          } else if (/^(MAIL FROM|RCPT TO)\b/i.test(line)) {
            socket.write('250 2.1.0 accepted\r\n');
          } else if (/^DATA\b/i.test(line)) {
            receivingMessage = true;
            socket.write('354 end with <CRLF>.<CRLF>\r\n');
          } else if (/^QUIT\b/i.test(line)) {
            socket.write('221 2.0.0 goodbye\r\n');
            socket.end();
          }
          newline = buffer.indexOf('\n');
        }
      });
    });

    await new Promise<void>((resolve) => smtpServer.listen(0, '127.0.0.1', resolve));
    const address = smtpServer.address();
    assert.ok(address && typeof address !== 'string');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 503 });
    try {
      const email = createEmailService(address.port);
      await email.sendCode('recipient@example.com', '123456', 'verify', 300);
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise<void>((resolve, reject) => {
        smtpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
