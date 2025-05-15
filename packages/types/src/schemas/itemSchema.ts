import { z } from "zod";

export const supplyItemSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  name: z.string().max(255),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  purchaseUrl: z.string().url().optional(),
  categories: z.array(z.string().uuid()),
  currentCount: z.number().nonnegative().max(1000),
  warnCount: z.number().nonnegative().max(1000),
});

export type SupplyItem = z.infer<typeof supplyItemSchema>;
