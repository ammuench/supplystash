<script setup lang="ts">
import type { SupplyItem } from "@supplystash/types";
import { onMounted, onUnmounted, useTemplateRef } from "vue";

import FocusItemDialog from "@/components/FocusItemDialog.vue";
import SupplyItemList from "@/components/SupplyItemList.vue";
import DefaultLayout from "@/components/layouts/DefaultLayout.vue";

import { useSupplyItemStore } from "@/stores/supplyItem.store";

const modalRef = useTemplateRef("item-details-dialog");

const supplyItemStore = useSupplyItemStore();

supplyItemStore.fetchItems();

const togggleFocusItemModal = (item: SupplyItem) => {
  supplyItemStore.setFocusedItem(item);
  modalRef.value?.showModal();
};

// TODO: Figure out if this makes sense long-term, maybe move this into App.vue?
onMounted(() => {
  supplyItemStore.subscribeToRealtimeItems();
});
onUnmounted(() => {
  supplyItemStore.unsubscribeFromRealtimeItems();
});
</script>

<template>
  <DefaultLayout>
    <div class="flex flex-col gap-2 min-h-full pb-64">
      <div v-if="supplyItemStore.isLoading">Loading....</div>
      <SupplyItemList
        v-for="supplyItem in supplyItemStore.items"
        v-else
        :key="supplyItem.id"
        :on-select="
          (item) => {
            togggleFocusItemModal(item);
          }
        "
        :item="supplyItem"
      />
      <FocusItemDialog ref="item-details-dialog" />
    </div>
  </DefaultLayout>
</template>
