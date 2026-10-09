import { Global, Module } from '@nestjs/common';

import { FeesService } from './fees.service.js';
import { PaymentsService } from './payments.service.js';

@Global()
@Module({
  providers: [FeesService, PaymentsService],
  exports: [FeesService, PaymentsService],
})
export class PaymentsModule {}
