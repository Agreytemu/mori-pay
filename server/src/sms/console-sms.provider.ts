import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';
import type { SmsMessage, SmsProvider } from './sms.provider.js';

/**
 * Development SMS provider: writes the message to the application log instead
 * of sending it. Swap for a Beem/NextSMS implementation before going live.
 * The full body (which contains OTP codes) is only logged in development.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async send(message: SmsMessage): Promise<void> {
    const masked = message.to.replace(/.(?=.{3})/g, '*');
    const body = this.config.isDevelopment
      ? ` body="${message.body}"`
      : ` bodyLength=${message.body.length}`;
    this.logger.log(`[SMS] to=${masked}${body}`);
  }
}
