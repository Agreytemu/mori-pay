import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  withdrawalSchema,
  type WithdrawalInput,
  type WithdrawalResult,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { WithdrawalsService } from './withdrawals.service.js';

@ApiTags('withdrawals')
@ApiBearerAuth()
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(withdrawalSchema)) input: WithdrawalInput,
  ): Promise<WithdrawalResult> {
    return this.withdrawals.create(user.userId, input);
  }
}
