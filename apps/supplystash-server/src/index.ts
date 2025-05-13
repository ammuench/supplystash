import { serve } from "@hono/node-server";
import { type SupplyItem } from "@supplystash/types";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/items_test", (c) => {
  const testItem: SupplyItem[] = [
    {
      id: "1234",
      name: "Lysol",
      count: 10,
      warnCount: 1,
    },
  ];
  return c.json({ testItem });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
