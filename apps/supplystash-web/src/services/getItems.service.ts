import type { SupplyItem } from "@supplystash/types";

import { supabase } from "@/utils/supabase";

export const getItems = async () => {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  if (!userId) {
    throw new Error("Invalid user session");
  }
  const { data: userHomes, error: userHomesError } = await supabase
    .from("user_homes")
    .select()
    .eq("user_id", data.session?.user.id);

  if (userHomesError) {
    throw new Error(userHomesError.message);
  }

  const userHomeIds = userHomes.map((userHome) => userHome.home_id);

  const { data: itemsData, error: itemsError } = await supabase
    .from("items")
    .select()
    .in("home_id", userHomeIds);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return itemsData as SupplyItem[];
};
