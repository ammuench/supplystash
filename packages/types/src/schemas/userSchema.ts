import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

import { users } from "../db-schema";

export const userSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users);
export const userUpdateSchema = createUpdateSchema(users);

// TODO: Add in type/shape for the settings object as we flesh that out
export type User = typeof users.$inferSelect;
