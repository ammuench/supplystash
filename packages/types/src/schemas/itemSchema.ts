import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

import { items } from "../db-schema";

export const supplyItemSchema = createSelectSchema(items);
export type SupplyItem = typeof items.$inferSelect;

export const supplyItemCreateSchema = createInsertSchema(items).omit({
  is_archived: true,
  last_updated_by_id: true,
  created_by_id: true,
});
export type SupplyItemCreatePayload = Omit<
  typeof items.$inferInsert,
  "is_archived" | "last_updated_by_id" | "created_by_id"
>;

export const supplyItemInsertSchema = createInsertSchema(items);
export type SupplyItemInsertPayload = typeof items.$inferInsert;
