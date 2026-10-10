import { Global, Module } from '@nestjs/common';

import { AblinerClient } from './abliner.client.js';
import { AblinerWebhookSignatureService } from './webhook-signature.service.js';

@Global()
@Module({
  providers: [AblinerClient, AblinerWebhookSignatureService],
  exports: [AblinerClient, AblinerWebhookSignatureService],
})
export class AblinerModule {}
