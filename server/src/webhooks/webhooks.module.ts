import { Module } from '@nestjs/common';

import { ReconciliationService } from './reconciliation.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [ReconciliationService],
})
export class WebhooksModule {}
