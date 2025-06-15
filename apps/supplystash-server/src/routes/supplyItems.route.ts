import {
  type SupplyItem,
  type SupplyItemInsert,
  supplyItemSchema,
} from "@supplystash/types";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";

const items = new Hono();

// ADD ITEM
items.post("/items", async (c) => {
  const newItem = await c.req.json<SupplyItemInsert>();

  const { success, data } = supplyItemSchema.safeParse({
    id: randomUUID(),
    ...newItem,
  });

  if (success) {
    itemsDatabase.items = [...itemsDatabase.items, data];
    return c.json(itemsDatabase);
  }

  // TODO: Add error messaging?
  return c.json({ message: "Invalid data format" }, 400);
});

// UPDATE ITEM
items.patch("/items/:id", async (c) => {
  const updateId = c.req.param("id");
  const updateIdx = itemsDatabase.items.findIndex(
    (item) => item.id === updateId
  );

  if (updateIdx === -1) {
    return c.json({ message: "No item with that ID" }, 404);
  }

  const updatedItem = await c.req.json<Partial<SupplyItem>>();
  const { success, data } = supplyItemSchema.safeParse({
    ...itemsDatabase.items[updateIdx],
    ...updatedItem,
  });
  if (success) {
    itemsDatabase.items = itemsDatabase.items.toSpliced(updateIdx, 1, data);
    return c.json(itemsDatabase);
  }

  // TODO: Add error messaging?
  return c.json({ message: "Invalid data format" }, 400);
});

// DELETE ITEM
items.delete("/items/:id", (c) => {
  const deleteId = c.req.param("id");
  const deleteIdx = itemsDatabase.items.findIndex(
    (item) => item.id === deleteId
  );

  if (deleteIdx === -1) {
    return c.json({ message: "No item with that ID" }, 404);
  }

  itemsDatabase.items = itemsDatabase.items.toSpliced(deleteIdx, 1);

  return c.json(itemsDatabase);
});

export default items;
