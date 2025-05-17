import type { SupplyItem } from "@supplystash/types";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useSupplyItemStore = defineStore("supplyItem", () => {
  const items = ref<SupplyItem[]>([]);
  const focusedItem = ref<SupplyItem | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const fetchItems = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch("http://localhost:3000/items");
      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }
      const responseJSON: { items: SupplyItem[] } = await response.json();
      items.value = responseJSON.items;
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
    isLoading,
    error,
    fetchItems,
  };
});
