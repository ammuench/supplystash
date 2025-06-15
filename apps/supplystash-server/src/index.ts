import { serve } from "@hono/node-server";
import * as dotenv from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "path";
import { fileURLToPath } from "url";

import ItemsRouter from "@/routes/supplyItems.route";

import { supabaseAuthMiddleware } from "./middleware/supabaseAuth.middleware";

const dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(dirname, "../../../../.env.local") });

const app = new Hono();
app.use(cors());
app.use(
  "*",
  supabaseAuthMiddleware({
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
    supabaseUrl: process.env.VITE_SUPABASE_URL,
  })
);
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
