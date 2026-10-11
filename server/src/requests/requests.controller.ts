import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  payRequestSchema,
  requestMoneySchema,
  type MoneyRequest,
  type PayRequestInput,
  type PayRequestResult,
  type RequestMoneyInput,
  type RequestMoneyResult,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequestsService } from './requests.service.js';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<MoneyRequest[]> {
    return this.requests.list(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(requestMoneySchema)) input: RequestMoneyInput,
  ): Promise<RequestMoneyResult> {
    return this.requests.create(user.userId, input);
  }

  @Post(':id/pay')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(payRequestSchema)) input: PayRequestInput,
  ): Promise<PayRequestResult> {
    return this.requests.pay(user.userId, id, input);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.requests.cancel(user.userId, id);
  }
}
