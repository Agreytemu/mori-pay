import { Module } from '@nestjs/common';

import { ReconciliationService } from './reconciliation.service.js';
import { ReconciliationSweeper } from './reconciliation.sweeper.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [ReconciliationService, ReconciliationSweeper],
  exports: [ReconciliationService],
})
export class WebhooksModule {}
