import type { UserHomeRecord } from "@supplystash/types";

import { supabase } from "@/utils/supabase";

import { getUserId } from "./getUserId.service";

export const getUserHomes = async (): Promise<UserHomeRecord[]> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error("Invalid user session");
  }

  const { data: userHomes, error: userHomesError } = await supabase
    .from("user_homes")
    .select()
    .overrideTypes<UserHomeRecord[]>();

  if (userHomesError) {
    throw new Error(userHomesError.message);
  }

  return userHomes;
};
