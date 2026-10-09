import { Injectable, Logger } from '@nestjs/common';

import type { SmsMessage, SmsProvider } from './sms.provider.js';

/**
 * Development SMS provider: writes the message to the application log instead
 * of sending it. Swap for a Beem/NextSMS implementation before going live.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(message: SmsMessage): Promise<void> {
    this.logger.log(`[SMS] to=${message.to} body="${message.body}"`);
  }
}
