<script setup lang="ts">
import SupplyItemList from "@/components/SupplyItemList.vue";

import { useSupplyItemStore } from "@/stores/supplyItem.store";

const supplyItemStore = useSupplyItemStore();

supplyItemStore.fetchItems();
</script>

<template>
  <div class="h-full overflow-y-scroll max-w-screen px-4 py-2">
    <div class="flex flex-col gap-2 min-h-full pb-64">
      <div v-if="supplyItemStore.isLoading">Loading....</div>
      <SupplyItemList
        v-for="supplyItem in supplyItemStore.items"
        v-else
        :key="supplyItem.id"
        :item="supplyItem"
      />
      <dialog
        id="my_modal_1"
        class="modal"
      >
        <div class="modal-box">
          <h3 class="text-lg font-bold">Hello!</h3>
          <p class="py-4">Press ESC key or click the button below to close</p>
          <div class="modal-action">
            <button
              @click="
                () => {
                  console.log(Date.now());
                }
              "
            >
              another btn
            </button>
            <form method="dialog">
              <!-- if there is a button in form, it will close the modal -->
              <button class="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  </div>
</template>
