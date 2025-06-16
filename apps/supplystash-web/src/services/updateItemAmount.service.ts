import type {
  SupplyItem,
  SupplyItemUpdateAction,
  SupplyItemUpdatePayload,
} from "@supplystash/types";

import { API_ROUTES } from "@/constants/ApiRoutes";

import { authorizedFetch } from "@/utils/api";

export const updateItemAmount = async (
  itemId: string,
  amt: number,
  action: SupplyItemUpdateAction
): Promise<SupplyItem> => {
  const body: SupplyItemUpdatePayload = {
    amount: amt,
    action: action,
  };
  const response = await authorizedFetch<SupplyItem>(
    API_ROUTES.itemsAmount.update(itemId),
    { method: "patch", body: JSON.stringify(body) }
  );

  return response;
};
