import { db } from "@/db";
import {
  type SupplyItemCreatePayload,
  type SupplyItemInsertPayload,
  type SupplyItemUpdatePayload,
  supplyItemInsertSchema,
  supplyItemUpdateSchema,
} from "@supplystash/types";
import { inventory_transactions, items } from "@supplystash/types/db";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { getUserHomeIds } from "@/utils/permissions";

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
    // ensure user belongs to the target home
    const allowedHomes = await getUserHomeIds(authUser.id);
    if (!allowedHomes.includes(data.home_id)) {
      return c.json(
        { message: "Forbidden: cannot add items to that home." },
        403
      );
    }
    try {
      const createdItem = await db.transaction(async (tx) => {
        const inserted = await tx.insert(items).values(data).returning();
        const newItemRecord = inserted[0];
        await tx.insert(inventory_transactions).values({
          item_id: newItemRecord.id,
          user_id: authUser.id,
          quantity_changed: data.current_inventory || 0,
          transaction_type: "create_item",
        });
        return newItemRecord;
      });
      return c.json(createdItem, 200);
    } catch (e) {
      return c.json({ message: "Error inserting data", error: e }, 500);
    }
  }

  // TODO: Add error messaging?
  return c.json({ message: "Invalid data format" }, 400);
});

// UPDATE ITEM AMOUNT
itemsRoutes.patch("/items/:id/amount", async (c) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    return c.json({ message: "Unauthorized request" }, 401);
  }
  const updateId = c.req.param("id");
  const updatePayload = await c.req.json<SupplyItemUpdatePayload>();
  const { success, data } = supplyItemUpdateSchema.safeParse(updatePayload);
  if (!success) {
    return c.json({ message: "Invalid data format" }, 400);
  }
  try {
    const updatedItem = await db.transaction(async (tx) => {
      let itemUpdateRows;
      switch (data.action) {
        case "set_amt":
          itemUpdateRows = await tx
            .update(items)
            .set({ current_inventory: data.amount })
            .where(eq(items.id, updateId))
            .returning();
          break;
        case "increase_amt":
          itemUpdateRows = await tx
            .update(items)
            .set({
              current_inventory: sql`${items.current_inventory} + ${data.amount}`,
            })
            .where(eq(items.id, updateId))
            .returning();
          break;
        case "decrease_amt":
          itemUpdateRows = await tx
            .update(items)
            .set({
              current_inventory: sql`${items.current_inventory} - ${data.amount}`,
            })
            .where(eq(items.id, updateId))
            .returning();
          break;
      }
      const updated = itemUpdateRows?.at(0);
      const changeAmount = data.amount;
      await tx.insert(inventory_transactions).values({
        item_id: updateId,
        user_id: authUser.id,
        quantity_changed: changeAmount,
        transaction_type: data.action,
      });
      return updated;
    });
    return c.json(updatedItem, 200);
  } catch (e) {
    return c.json({ message: "Error updating item", error: e }, 500);
  }
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
