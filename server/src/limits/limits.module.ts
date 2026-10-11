import { Global, Module } from '@nestjs/common';

import { LimitsService } from './limits.service.js';

@Global()
@Module({
  providers: [LimitsService],
  exports: [LimitsService],
})
export class LimitsModule {}
