import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  publicPromotionsQuerySchema,
  type PublicPromotionsQuery,
} from '@mori-pay/contracts';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PromotionsService } from './promotions.service.js';

@ApiTags('promotions')
@ApiBearerAuth()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(publicPromotionsQuerySchema))
    query: PublicPromotionsQuery,
  ) {
    return this.promotions.listActive(query.placement);
  }
}
