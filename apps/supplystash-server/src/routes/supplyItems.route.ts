import { db } from "@/db";
import {
  type SupplyItemCreatePayload,
  type SupplyItemInsertPayload,
  supplyItemInsertSchema,
} from "@supplystash/types";
import { items } from "@supplystash/types/db";
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

// // UPDATE ITEM
// items.patch("/items/:id", async (c) => {
//   const updateId = c.req.param("id");
//   const updateIdx = itemsDatabase.items.findIndex(
//     (item) => item.id === updateId
//   );
//
//   if (updateIdx === -1) {
//     return c.json({ message: "No item with that ID" }, 404);
//   }
//
//   const updatedItem = await c.req.json<Partial<SupplyItem>>();
//   const { success, data } = supplyItemSchema.safeParse({
//     ...itemsDatabase.items[updateIdx],
//     ...updatedItem,
//   });
//   if (success) {
//     itemsDatabase.items = itemsDatabase.items.toSpliced(updateIdx, 1, data);
//     return c.json(itemsDatabase);
//   }
//
//   // TODO: Add error messaging?
//   return c.json({ message: "Invalid data format" }, 400);
// });
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
