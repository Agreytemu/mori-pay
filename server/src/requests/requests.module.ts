import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
