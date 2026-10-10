import { Global, Module } from '@nestjs/common';

import { SettlementService } from './settlement.service.js';

@Global()
@Module({
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
