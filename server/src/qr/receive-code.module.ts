import { Global, Module } from '@nestjs/common';

import { ReceiveCodeService } from './receive-code.service.js';

@Global()
@Module({
  providers: [ReceiveCodeService],
  exports: [ReceiveCodeService],
})
export class ReceiveCodeModule {}
