import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

import { AppConfigService } from '../config/app-config.service.js';

function getSmtpFailureDetails(
  error: unknown,
  secrets: readonly string[],
): { code?: string; command?: string; response?: string; responseCode?: number } {
  if (typeof error !== 'object' || error === null) return {};

  const smtpError = error as Record<string, unknown>;
  const redact = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;

    let safeValue = value;
    for (const secret of secrets) {
      if (!secret) continue;
      safeValue = safeValue.replaceAll(secret, '[redacted]');
      const compactSecret = secret.replace(/\s/g, '');
      if (compactSecret !== secret) {
        safeValue = safeValue.replaceAll(compactSecret, '[redacted]');
      }
    }

    return safeValue
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(/\b\d{4,8}\b/g, '[redacted-number]')
      .replace(/\b[A-Z0-9_-]{24,}\b/gi, '[redacted-token]')
      .slice(0, 500);
  };

  const code = redact(smtpError.code);
  const command = redact(smtpError.command);
  const response = redact(smtpError.response);
  const responseCode =
    typeof smtpError.responseCode === 'number' ? smtpError.responseCode : undefined;

  return {
    ...(code ? { code } : {}),
    ...(command ? { command } : {}),
    ...(response ? { response } : {}),
    ...(responseCode !== undefined ? { responseCode } : {}),
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransport: Transporter | null = null;

  constructor(private readonly config: AppConfigService) {}

  async sendCode(
    email: string,
    code: string,
    purpose: 'verify' | 'password_reset',
    expiresInSeconds: number,
  ): Promise<void> {
    const { apiKey, from, smtp } = this.config.email;
    const smtpConfigured = Boolean(smtp.host && smtp.user && smtp.pass);
    if ((!apiKey && !smtpConfigured) || !from) {
      if (!this.config.isProduction) {
        this.logger.warn(
          `Email delivery is not configured; ${purpose} code is available only in the development response`,
        );
        return;
      }
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Contact support.',
      );
    }

    const subject =
      purpose === 'verify'
        ? 'Verify your Mori Pay email'
        : 'Reset your Mori Pay password';
    const heading =
      purpose === 'verify' ? 'Verify your email' : 'Reset your password';
    const expiresInMinutes = Math.max(1, Math.ceil(expiresInSeconds / 60));
    const text = `${heading}\n\nYour Mori Pay verification code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`;

    if (apiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Mori Pay <${from}>`,
            to: [email],
            subject,
            text,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) return;

        this.logger.error(
          `Resend email delivery failed with status ${response.status}`,
        );
      } catch {
        this.logger.error('Resend email delivery request failed');
      }
    }

    if (smtpConfigured) {
      try {
        this.smtpTransport ??= nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: { user: smtp.user, pass: smtp.pass },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 10_000,
        });
        await this.smtpTransport.sendMail({
          from: { name: 'Mori Pay', address: from },
          to: email,
          subject,
          text,
        });
        return;
      } catch (error) {
        const details = getSmtpFailureDetails(error, [
          smtp.user ?? '',
          smtp.pass ?? '',
          from,
          email,
          code,
        ]);
        this.logger.error(`SMTP email delivery failed ${JSON.stringify(details)}`);
      }
    }

    throw new ServiceUnavailableException(
      'Could not deliver the email. Please try again later.',
    );
  }
}
