import { Global, Module } from '@nestjs/common';

import { ClickPesaClient } from './clickpesa.client.js';
import { ClickPesaWebhookSignatureService } from './webhook-signature.service.js';

@Global()
@Module({
  providers: [ClickPesaClient, ClickPesaWebhookSignatureService],
  exports: [ClickPesaClient, ClickPesaWebhookSignatureService],
})
export class ClickPesaModule {}
