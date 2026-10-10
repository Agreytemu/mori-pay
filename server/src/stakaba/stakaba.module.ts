import { Global, Module } from '@nestjs/common';

import { StakabaClient } from './stakaba.client.js';
import { WebhookSignatureService } from './webhook-signature.service.js';

@Global()
@Module({
  providers: [StakabaClient, WebhookSignatureService],
  exports: [StakabaClient, WebhookSignatureService],
})
export class StakabaModule {}
