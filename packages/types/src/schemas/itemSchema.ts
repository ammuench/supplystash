import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

import { items } from "../db-schema";

export const supplyItemSchema = createSelectSchema(items);
export const supplyItemInsertSchema = createInsertSchema(items);
export const supplyItemUpdateSchema = createUpdateSchema(items);

export type SupplyItem = typeof items.$inferSelect;
