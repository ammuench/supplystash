import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import path from "path";
import postgres from "postgres";
import { fileURLToPath } from "url";

import * as schema from "./schema";

const dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(dirname, "../../../../.env.local") });

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  database: "postgres",
});

console.log("ENV CHECK", process.env.SUPABASE_URL);

export const db = drizzle({ client, schema });
