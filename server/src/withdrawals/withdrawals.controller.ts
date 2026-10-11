import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  recipientLookupSchema,
  withdrawalPreviewQuerySchema,
  withdrawalSchema,
  type RecipientLookupInput,
  type WithdrawalInput,
  type WithdrawalPreviewQuery,
  type WithdrawalResult,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  WithdrawalsService,
  type RecipientLookupResult,
} from './withdrawals.service.js';

@ApiTags('withdrawals')
@ApiBearerAuth()
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(withdrawalSchema)) input: WithdrawalInput,
  ): Promise<WithdrawalResult> {
    return this.withdrawals.create(user.userId, input);
  }

  @Get('preview')
  async preview(
    @Query(new ZodValidationPipe(withdrawalPreviewQuerySchema))
    query: WithdrawalPreviewQuery,
  ): Promise<{ amount: number; fee: number; feePercentage: number; total: number }> {
    const amount = BigInt(query.amount);
    const feeDetail = await this.withdrawals.resolveFeeDetail(amount);
    return {
      amount: Number(amount),
      fee: Number(feeDetail.fee),
      feePercentage: feeDetail.percentage,
      total: Number(amount + feeDetail.fee),
    };
  }

  @Get('lookup')
  lookup(
    @Query(new ZodValidationPipe(recipientLookupSchema))
    query: RecipientLookupInput,
  ): Promise<RecipientLookupResult> {
    return this.withdrawals.lookupRecipient(query.phone);
  }
}
