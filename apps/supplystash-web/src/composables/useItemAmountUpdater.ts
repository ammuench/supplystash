import type { SupplyItemUpdateAction } from "@supplystash/types";
import type { SupplyItem } from "@supplystash/types";
import { ref } from "vue";

import { updateItemAmount } from "@/services/updateItemAmount.service";

import { useSupplyItemStore } from "@/stores/supplyItem.store";

export const useItemAmountUpdater = () => {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const store = useSupplyItemStore();

  /**
   * Calls your service, then updates the Pinia state on success.
   * @returns the updated item
   */
  const updateItem = async (
    itemId: string,
    newAmount: number,
    isSetAction = false
  ): Promise<SupplyItem> => {
    isLoading.value = true;
    error.value = null;

    try {
      if (newAmount < 0) {
        throw new Error("Cannot set item amount below 0");
      }

      const updateItemIdx = store.items.findIndex((i) => i.id === itemId);
      if (updateItemIdx === -1) {
        throw new Error("Invalid item id");
      }
      const oldAmt = store.items[updateItemIdx].current_inventory;

      if (oldAmt === newAmount) {
        return store.items[updateItemIdx];
      } else {
        let updated: SupplyItem;

        if (isSetAction) {
          updated = await updateItemAmount(itemId, newAmount, "set_amt");
        } else {
          const changeAmt = Math.abs(newAmount - oldAmt);
          const changeAction: SupplyItemUpdateAction =
            newAmount > oldAmt ? "increase_amt" : "decrease_amt";

          console.log({
            log: "updater-check",
            itemId,
            newAmount,
            oldAmt,
            changeAmt,
            changeAction,
          });

          updated = await updateItemAmount(itemId, changeAmt, changeAction);
        }

        store.items[updateItemIdx] = updated;

        return updated;
      }
    } catch (err: unknown) {
      error.value =
        (err as { message: string } | undefined)?.message ??
        "Failed to update item amount";
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return { updateItem, isLoading, error };
};
