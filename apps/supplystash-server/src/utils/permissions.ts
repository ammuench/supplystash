import { db } from "@/db";
import { user_homes } from "@supplystash/types/db";

/**
 * Returns an array of home IDs the given user is a member of.
 */
export async function getUserHomeIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ home_id: user_homes.home_id })
    .from(user_homes)
    .where(user_homes.user_id.eq(userId));
  return rows.map((r) => r.home_id);
}
