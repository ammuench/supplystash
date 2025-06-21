import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SupplyItem } from "@supplystash/types";
import { defineStore } from "pinia";
import { ref } from "vue";

import { getItems } from "@/services/getItems.service";

import { supabase } from "@/utils/supabase";

import { useToastsStore } from "./toasts.store";

export const useSupplyItemStore = defineStore("supplyItem", () => {
  const items = ref<SupplyItem[]>([]);
  const focusedItem = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const setFocusedItem = (focusItem: SupplyItem | undefined | null) => {
    if (focusItem) {
      focusedItem.value = focusItem.id;
    }
  };

  const fetchItems = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await getItems();
      items.value = response;
      focusedItem.value = null;
    } catch (err) {
      error.value = `Error fetching items: ${err}`;
    } finally {
      isLoading.value = false;
    }
  };

  const toastStore = useToastsStore();
  const realtimeChannel = ref<RealtimeChannel | null>(null);

  const subscribeToRealtimeItems = () => {
    realtimeChannel.value = supabase
      .channel("public:items")
      .on<SupplyItem>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items" },
        (payload) => {
          items.value = [...items.value, payload.new];
          toastStore.createToast({
            message: `"${payload.new.title}" added to supply list`,
            status: "success",
            dismissable: true,
          });
        }
      )
      .on<SupplyItem>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items" },
        (payload) => {
          items.value = items.value.map((item) =>
            item.id === payload.new.id ? payload.new : item
          );
          if (!toastStore.doesToastExistForItem(payload.new.id)) {
            toastStore.createToast({
              message: `"${payload.new.title}" updated`,
              status: "info",
              dismissable: true,
            });
          }
        }
      )
      .on<SupplyItem>(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "items" },
        (payload) => {
          items.value = items.value.filter(
            (item) => item.id !== payload.old.id
          );
          toastStore.createToast({
            message: `"${payload.old.title}" removed from supply list`,
            status: "warning",
            dismissable: true,
          });
        }
      )
      .subscribe();
  };

  const unsubscribeFromRealtimeItems = () => {
    if (realtimeChannel.value) {
      realtimeChannel.value.unsubscribe();
      realtimeChannel.value = null;
    }
  };

  return {
    items,
    focusedItem,
    isLoading,
    error,
    setFocusedItem,
    fetchItems,
    subscribeToRealtimeItems,
    unsubscribeFromRealtimeItems,
  };
});
