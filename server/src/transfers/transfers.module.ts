import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
