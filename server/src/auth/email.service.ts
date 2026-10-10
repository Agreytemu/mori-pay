import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: AppConfigService) {}

  async sendCode(
    email: string,
    code: string,
    purpose: 'verify' | 'password_reset',
    expiresInSeconds: number,
  ): Promise<void> {
    const { apiKey, from } = this.config.email;
    if (!apiKey || !from) {
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

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
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
    } catch {
      this.logger.error('Resend email delivery request failed');
      throw new ServiceUnavailableException(
        'Could not deliver the email. Please try again later.',
      );
    }

    if (!response.ok) {
      this.logger.error(`Resend email delivery failed with status ${response.status}`);
      throw new ServiceUnavailableException(
        'Could not deliver the email. Please try again later.',
      );
    }
  }
}
