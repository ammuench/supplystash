import { db } from "@/db";
import {
  type SupplyItemCreatePayload,
  type SupplyItemInsertPayload,
  type SupplyItemUpdatePayload,
  supplyItemInsertSchema,
  supplyItemUpdateSchema,
} from "@supplystash/types";
import { items } from "@supplystash/types/db";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";

const itemsRoutes = new Hono();

// ADD ITEM
itemsRoutes.post("/items", async (c) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    return c.json({ message: "Unauthorized request" }, 401);
  }

  const newItem = await c.req.json<SupplyItemCreatePayload>();
  const insertItem: SupplyItemInsertPayload = {
    ...newItem,
    is_archived: false,
    created_by_id: authUser.id,
    last_updated_by_id: authUser.id,
  };

  const { success, data } = supplyItemInsertSchema.safeParse(insertItem);

  if (success) {
    try {
      const result = await db.insert(items).values(data).returning();
      return c.json(result[0], 200);
    } catch (e) {
      return c.json({ message: "Error inserting data", error: e }, 500);
    }
  }

  // TODO: Add error messaging?
  return c.json({ message: "Invalid data format" }, 400);
});

// UPDATE ITEM
itemsRoutes.patch("/items/:id", async (c) => {
  const updateId = c.req.param("id");
  const updatePayload = await c.req.json<SupplyItemUpdatePayload>();

  const { success, data } = supplyItemUpdateSchema.safeParse(updatePayload);

  if (success) {
    const updatedItem = await db.transaction(async (tx) => {
      let itemUpdate;
      switch (data.action) {
        case "set_amt":
          itemUpdate = await tx
            .update(items)
            .set({ current_inventory: data.amount })
            .where(eq(items.id, updateId))
            .returning();
          break;
        case "increase_amt":
          itemUpdate = await tx
            .update(items)
            .set({
              current_inventory: sql`${items.current_inventory} + ${data.amount}`,
            })
            .where(eq(items.id, updateId))
            .returning();
          break;
        case "decrease_amt":
          itemUpdate = await tx
            .update(items)
            .set({
              current_inventory: sql`${items.current_inventory} - ${data.amount}`,
            })
            .where(eq(items.id, updateId))
            .returning();
          break;
      }
      return itemUpdate[0];
    });
  }

  // TODO: Add error messaging?
  return c.json({ message: "Invalid data format" }, 400);
});
//
// // DELETE ITEM
// items.delete("/items/:id", (c) => {
//   const deleteId = c.req.param("id");
//   const deleteIdx = itemsDatabase.items.findIndex(
//     (item) => item.id === deleteId
//   );
//
//   if (deleteIdx === -1) {
//     return c.json({ message: "No item with that ID" }, 404);
//   }
//
//   itemsDatabase.items = itemsDatabase.items.toSpliced(deleteIdx, 1);
//
//   return c.json(itemsDatabase);
// });

export default itemsRoutes;
