import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  payMerchantSchema,
  type Merchant,
  type PayMerchantInput,
  type PayMerchantResult,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { MerchantsService } from './merchants.service.js';

@ApiTags('merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get()
  list(): Promise<Merchant[]> {
    return this.merchants.list();
  }

  @Post('pay')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(payMerchantSchema)) input: PayMerchantInput,
  ): Promise<PayMerchantResult> {
    return this.merchants.pay(user.userId, input);
  }
}
