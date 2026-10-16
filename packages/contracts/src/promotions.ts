import { z } from 'zod';

import { promotionPlacementSchema } from './admin';

/**
 * Public (in-app) view of a promotion. Clients never see the internal
 * `active` flag or creation metadata — the server only returns promotions
 * that are active *and* inside their scheduled window.
 */
export const publicPromotionSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  placement: promotionPlacementSchema,
  imageUrl: z.string().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});
export type PublicPromotion = z.infer<typeof publicPromotionSchema>;

export const publicPromotionsQuerySchema = z.object({
  placement: promotionPlacementSchema.optional(),
});
export type PublicPromotionsQuery = z.infer<typeof publicPromotionsQuerySchema>;

export const publicPromotionsResponseSchema = z.object({
  items: z.array(publicPromotionSchema),
});
export type PublicPromotionsResponse = z.infer<typeof publicPromotionsResponseSchema>;
