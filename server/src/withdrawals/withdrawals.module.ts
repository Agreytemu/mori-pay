import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { WithdrawalsController } from './withdrawals.controller.js';
import { WithdrawalsService } from './withdrawals.service.js';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
})
export class WithdrawalsModule {}
