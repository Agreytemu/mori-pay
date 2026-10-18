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

import { ablinerWebhookSchema, type AblinerWebhookInput } from '@mori-pay/contracts';
import { z } from 'zod';

import { ClickPesaWebhookSignatureService } from '../clickpesa/webhook-signature.service.js';
import {
  ABLINER_EVENT_ID_HEADER,
  ABLINER_SIGNATURE_HEADER,
  ABLINER_TIMESTAMP_HEADER,
  AblinerWebhookSignatureService,
} from '../abliner/webhook-signature.service.js';
import type { ClickPesaWebhookInput } from '../clickpesa/clickpesa.types.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReconciliationService } from './reconciliation.service.js';

const clickPesaWebhookSchema = z
  .object({
    event: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
    checksum: z.string().optional(),
    checksumMethod: z.string().optional(),
  })
  .passthrough();

@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signature: AblinerWebhookSignatureService,
    private readonly clickPesaSignature: ClickPesaWebhookSignatureService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Public()
  @Post('abliner')
  @HttpCode(HttpStatus.OK)
  async abliner(
    @Req() request: RawBodyRequest<Request>,
    @Body(new ZodValidationPipe(ablinerWebhookSchema))
    payload: AblinerWebhookInput,
  ): Promise<{ received: true }> {
    const header = (name: string): string | undefined => {
      const value = request.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };

    if (
      !this.signature.verify(
        request.rawBody,
        header(ABLINER_SIGNATURE_HEADER),
        header(ABLINER_TIMESTAMP_HEADER),
      )
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const eventId = payload.id || header(ABLINER_EVENT_ID_HEADER) || payload.data.id;

    const event = await this.prisma.ablinerWebhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        event: payload.event,
        transactionReference: payload.data.id,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: { payload: payload as unknown as Prisma.InputJsonValue },
    });

    try {
      await this.reconciliation.process(payload);
      await this.prisma.ablinerWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), error: null },
      });
    } catch (error) {
      await this.prisma.ablinerWebhookEvent.update({
        where: { id: event.id },
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }

    return { received: true };
  }

  @Public()
  @Post('clickpesa')
  @HttpCode(HttpStatus.OK)
  async clickpesa(
    @Body() payload: unknown,
  ): Promise<{ received: true }> {
    const parsed = clickPesaWebhookSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid ClickPesa webhook payload');
    }
    if (!this.clickPesaSignature.verify(parsed.data)) {
      throw new UnauthorizedException('Invalid ClickPesa webhook checksum');
    }

    await this.reconciliation.processClickPesa(
      parsed.data as ClickPesaWebhookInput,
    );
    return { received: true };
  }
}
