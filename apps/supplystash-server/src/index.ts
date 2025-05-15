import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { generateMockItems } from "./utils/mocks/generateMockItems.js";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/items_test", (c) => {
  return c.json({ items: generateMockItems(5) });
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
