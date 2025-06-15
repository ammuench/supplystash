import type { SupplyItem } from "@supplystash/types";
import { defineStore } from "pinia";
import { ref } from "vue";

import { getItems } from "@/services/getItems.service";

export const useSupplyItemStore = defineStore("supplyItem", () => {
  const items = ref<SupplyItem[]>([]);
  const focusedItem = ref<SupplyItem | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const setFocusedItem = (focusItem: SupplyItem | undefined | null) => {
    if (focusItem) {
      focusedItem.value = focusItem;
    }
  };

  const fetchItems = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await getItems();
      items.value = response;
      // TODO: Make sure this is fine...
      focusedItem.value = null;
    } catch (err) {
      error.value = `Error fetching items: ${err}`;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    items,
    focusedItem,
    isLoading,
    error,
    setFocusedItem,
    fetchItems,
  };
});
