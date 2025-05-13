import { z } from "zod";

export const itemSchema = z.object({
  name: z.string().max(255),
  id: z.string().uuid(),
  count: z.number().nonnegative(),
  warnCount: z.number().nonnegative(),
});

export type SupplyItem = z.infer<typeof itemSchema>;
