import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  previewTransferSchema,
  recipientLookupSchema,
  sendMoneySchema,
  verifyReceiveCodeSchema,
  type PreviewTransferInput,
  type RecipientLookup,
  type RecipientLookupInput,
  type SendMoneyInput,
  type SendMoneyResult,
  type TransferPreview,
  type VerifyReceiveCodeInput,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { TransfersService } from './transfers.service.js';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get('recipient')
  lookupRecipient(
    @Query(new ZodValidationPipe(recipientLookupSchema)) query: RecipientLookupInput,
  ): Promise<RecipientLookup> {
    return this.transfers.resolveRecipient(query.phone);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @Body(new ZodValidationPipe(previewTransferSchema)) input: PreviewTransferInput,
  ): Promise<TransferPreview> {
    return this.transfers.preview(input);
  }

  @Post('verify-receive-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  verifyReceiveCode(
    @Body(new ZodValidationPipe(verifyReceiveCodeSchema)) input: VerifyReceiveCodeInput,
  ): Promise<RecipientLookup> {
    return this.transfers.verifyReceiveCode(input.code);
  }

  @Post('send')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(sendMoneySchema)) input: SendMoneyInput,
  ): Promise<SendMoneyResult> {
    return this.transfers.send(user.userId, input);
  }
}
