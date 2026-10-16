import { Injectable } from '@nestjs/common';

import type {
  PublicPromotionsResponse,
  PromotionPlacement,
} from '@mori-pay/contracts';

import { PrismaService } from '../prisma/prisma.service.js';

/** Hard cap on how many promotions a single placement can return to a client. */
const MAX_ACTIVE_PER_PLACEMENT = 20;

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Promotions a customer should currently see for a placement: switched on,
   * not started in the future, and not already expired. `null` placement
   * returns every placement mixed together.
   */
  async listActive(placement?: PromotionPlacement): Promise<PublicPromotionsResponse> {
    const now = new Date();
    const rows = await this.prisma.promotion.findMany({
      where: {
        active: true,
        ...(placement ? { placement } : {}),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ACTIVE_PER_PLACEMENT,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        placement: row.placement as PromotionPlacement,
        imageUrl: row.imageUrl,
        startsAt: row.startsAt?.toISOString() ?? null,
        endsAt: row.endsAt?.toISOString() ?? null,
      })),
    };
  }
}
