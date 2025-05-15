import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import ItemsRouter from "@/routes/supplyItems.route";

const app = new Hono();
app.use(cors());
app.route("/", ItemsRouter);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
