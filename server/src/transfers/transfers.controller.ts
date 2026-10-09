import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  previewTransferSchema,
  recipientLookupSchema,
  sendMoneySchema,
  type PreviewTransferInput,
  type RecipientLookup,
  type RecipientLookupInput,
  type SendMoneyInput,
  type SendMoneyResult,
  type TransferPreview,
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

  @Post('send')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(sendMoneySchema)) input: SendMoneyInput,
  ): Promise<SendMoneyResult> {
    return this.transfers.send(user.userId, input);
  }
}
