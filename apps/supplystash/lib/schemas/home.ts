import { z } from "zod";

// Mirrors the `homes_name_length` constraint in
// supabase/migrations/20261111000001_home_name_length.sql. The database is the
// real gate; validating here first means the user sees the rule before a round
// trip. Change the two together.
//
// The two count differently: zod counts UTF-16 units, Postgres counts
// characters, so an emoji is 2 here and 1 there. This side is the stricter one,
// so a name accepted here never fails in the database.
export const HOME_NAME_MAX_LENGTH = 50;

// Exported: the create home screen shows the same message if the database's
// constraint ever rejects a name this schema let through.
export const HOME_NAME_TOO_LONG_MESSAGE = `Home name must be ${HOME_NAME_MAX_LENGTH} characters or fewer.`;

// Trimmed before the checks, as `create_home` trims before it stores: spaces
// around a name do not count toward its length, and a name of only spaces is
// empty.
const homeNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name for your home.")
  .max(HOME_NAME_MAX_LENGTH, HOME_NAME_TOO_LONG_MESSAGE);

export const createHomeSchema = z.object({
  name: homeNameSchema,
});

export type CreateHomeValues = z.infer<typeof createHomeSchema>;
