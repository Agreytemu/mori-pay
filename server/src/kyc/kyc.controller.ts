import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { submitKycSchema, type SubmitKycInput } from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { KycService } from './kyc.service.js';

@ApiTags('account')
@ApiBearerAuth()
@Controller('account/kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get()
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.kyc.getOverview(user.userId);
  }

  @Post('submissions')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(submitKycSchema)) input: SubmitKycInput,
  ) {
    return this.kyc.submit(user.userId, input);
  }
}
