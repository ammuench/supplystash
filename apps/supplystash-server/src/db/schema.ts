import { integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const supplyItems = pgTable("supply_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: uuid("list_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  purchaseUrl: text("purchase_url"),
  categories: jsonb("categories").$type<string[]>().notNull(),
  currentCount: integer("current_count").notNull(),
  warnCount: integer("warn_count").notNull(),
});

export type DrizzleSupplyItem = typeof supplyItems.$inferSelect;
