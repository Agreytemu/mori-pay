import { Module } from '@nestjs/common';

import { ReconciliationService } from './reconciliation.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class WebhooksModule {}
