// import { SupabaseClient } from '@supabase/supabase-js'
import type { User } from "@supabase/supabase-js";
import type { MiddlewareHandler } from "hono";

import { supabase } from "@/utils/supabase";

declare module "hono" {
  interface ContextVariableMap {
    authUser: User | null;
  }
}

export const supabaseAuthMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.split(" ")[1]; // Extract token after "Bearer "

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      console.error({ log: "SUPABASE_ERROR", error });
      // TODO: Probably put a redirect here?
      c.set("authUser", null);
    } else {
      c.set("authUser", user);
    }

    await next();
  };
};
