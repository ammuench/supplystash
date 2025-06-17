import { db } from "@/db";
import { eq } from "drizzle-orm";

import { user_homes } from "@/db/schema";

/**
 * Returns an array of home IDs the given user is a member of.
 */
export async function getUserHomeIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ home_id: user_homes.home_id })
    .from(user_homes)
    .where(eq(user_homes.user_id, userId));
  return rows.map((r) => r.home_id);
}
