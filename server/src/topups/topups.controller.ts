import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  topupCardSchema,
  topupCardPreviewQuerySchema,
  topupMobileMoneySchema,
  type CardTopupResult,
  type FeePreview,
  type TopupCardPreviewQuery,
  type TopupCardInput,
  type TopupInitResult,
  type TopupMobileMoneyInput,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { TopUpsService } from './topups.service.js';

@ApiTags('topups')
@ApiBearerAuth()
@Controller('topups')
export class TopUpsController {
  constructor(private readonly topups: TopUpsService) {}

  @Get('card/preview')
  previewCard(
    @Query(new ZodValidationPipe(topupCardPreviewQuerySchema))
    query: TopupCardPreviewQuery,
  ): Promise<FeePreview> {
    return this.topups.previewCard(BigInt(query.amount));
  }

  @Post('mobile-money')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  mobileMoney(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(topupMobileMoneySchema)) input: TopupMobileMoneyInput,
  ): Promise<TopupInitResult> {
    return this.topups.initiateMobileMoney(user.userId, input);
  }

  @Post('card')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  card(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(topupCardSchema)) input: TopupCardInput,
  ): Promise<CardTopupResult> {
    return this.topups.initiateCard(user.userId, input);
  }
}
