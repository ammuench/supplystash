import type { SupplyItem } from "@supplystash/types";

import { supabase } from "@/utils/supabase";

import { getUserHomes } from "./getUserHomes.service";

export const getItems = async (): Promise<SupplyItem[]> => {
  const userHomeIds = (await getUserHomes()).map(
    (userHome) => userHome.home_id
  );

  const { data: itemsData, error: itemsError } = await supabase
    .from("items")
    .select()
    .in("home_id", userHomeIds)
    .overrideTypes<SupplyItem[]>();

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return itemsData;
};
