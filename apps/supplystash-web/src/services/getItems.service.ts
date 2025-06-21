import type { SupplyItem } from "@supplystash/types";

import { supabase } from "@/utils/supabase";

import { getUserId } from "./getUserId.service";

export const getItems = async (): Promise<SupplyItem[]> => {
  const userId = await getUserId();

  if (!userId) {
    throw new Error("Invalid user session");
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from("items")
    .select()
    .overrideTypes<SupplyItem[]>();

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return itemsData;
};
