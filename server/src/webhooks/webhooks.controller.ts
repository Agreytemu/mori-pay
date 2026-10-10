import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';

import { stakabaWebhookSchema, type StakabaWebhookInput } from '@mori-pay/contracts';

import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  STAKABA_SIGNATURE_HEADER,
  WebhookSignatureService,
} from '../stakaba/webhook-signature.service.js';
import { ReconciliationService } from './reconciliation.service.js';

@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signature: WebhookSignatureService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Public()
  @Post('stakaba')
  @HttpCode(HttpStatus.OK)
  async stakaba(
    @Req() request: RawBodyRequest<Request>,
    @Body(new ZodValidationPipe(stakabaWebhookSchema)) payload: StakabaWebhookInput,
  ): Promise<{ received: true }> {
    const header = request.headers[STAKABA_SIGNATURE_HEADER];
    const signature = Array.isArray(header) ? header[0] : header;

    if (!this.signature.verify(request.rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = await this.prisma.stakabaWebhookEvent.upsert({
      where: {
        internalReference_event: {
          internalReference: payload.internalReference,
          event: payload.event,
        },
      },
      create: {
        internalReference: payload.internalReference,
        event: payload.event,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: { payload: payload as unknown as Prisma.InputJsonValue },
    });

    try {
      await this.reconciliation.process(payload);
      await this.prisma.stakabaWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), error: null },
      });
    } catch (error) {
      await this.prisma.stakabaWebhookEvent.update({
        where: { id: event.id },
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }

    return { received: true };
  }
}
