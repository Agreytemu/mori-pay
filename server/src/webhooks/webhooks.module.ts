import { Module } from '@nestjs/common';

import { ReconciliationService } from './reconciliation.service.js';
import { ReconciliationSweeper } from './reconciliation.sweeper.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [ReconciliationService, ReconciliationSweeper],
  exports: [ReconciliationService, ReconciliationSweeper],
})
export class WebhooksModule {}
