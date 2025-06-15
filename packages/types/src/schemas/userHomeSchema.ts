import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

import { user_homes } from "../db-schema";

export const userHomeSchema = createSelectSchema(user_homes);
export const userHomeInsertSchema = createInsertSchema(user_homes);
export const userHomeUpdateSchema = createUpdateSchema(user_homes);

export type UserHomeRecord = typeof user_homes.$inferSelect;
