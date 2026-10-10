import { Injectable } from '@nestjs/common';

import { AblinerClient } from '../abliner/abliner.client.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { SmsMessage, SmsProvider } from './sms.provider.js';

/** Sends OTP and notification SMS through Abliner's Bulk SMS API. */
@Injectable()
export class AblinerSmsProvider implements SmsProvider {
  constructor(
    private readonly abliner: AblinerClient,
    private readonly config: AppConfigService,
  ) {}

  async send(message: SmsMessage): Promise<void> {
    await this.abliner.sendSms({
      recipient: message.to,
      message: message.body,
      senderId: this.config.abliner.smsSenderId,
    });
  }
}
