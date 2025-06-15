import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

import { homes } from "../db-schema";

export const homeSchema = createSelectSchema(homes);
export const homeInsertSchema = createInsertSchema(homes);
export const homeUpdateSchema = createUpdateSchema(homes);

export type Home = typeof homes.$inferSelect;
