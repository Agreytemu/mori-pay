import { Global, Module } from '@nestjs/common';

import { AblinerSmsProvider } from './abliner-sms.provider.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ConsoleSmsProvider } from './console-sms.provider.js';
import { SMS_PROVIDER, type SmsProvider } from './sms.provider.js';

@Global()
@Module({
  providers: [
    AblinerSmsProvider,
    ConsoleSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [AppConfigService, AblinerSmsProvider, ConsoleSmsProvider],
      useFactory: (
        config: AppConfigService,
        abliner: AblinerSmsProvider,
        consoleProvider: ConsoleSmsProvider,
      ): SmsProvider =>
        config.sms.provider === 'abliner' ? abliner : consoleProvider,
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
