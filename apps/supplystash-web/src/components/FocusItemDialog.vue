<script setup lang="ts">
import { CubeIcon, MinusIcon, PlusIcon } from "@heroicons/vue/24/outline";
import { ref, useTemplateRef } from "vue";

import { useSupplyItemStore } from "../stores/supplyItem.store";

const supplyItemStore = useSupplyItemStore();

const focusDialog = useTemplateRef("focus-item-details-dialog");

const showModal = () => {
  if (supplyItemStore.focusedItem) {
    countValue.value = supplyItemStore.focusedItem.currentCount;
  }
  focusDialog.value?.showModal();
};

const dismissModal = () => {
  focusDialog.value?.close();
};

const countValue = ref<number>(0);

// Add these new methods for validation and increment/decrement
const updateCount = (newValue: string | number) => {
  const cacheValue = countValue.value;
  console.log("UPDATING COUNT", newValue, countValue.value);
  // Convert to number and validate
  const numValue =
    typeof newValue === "string" ? parseInt(newValue, 10) : newValue;

  // Check if it's a valid number and not negative
  if (!isNaN(numValue) && numValue >= 0) {
    countValue.value = numValue;
  } else {
    countValue.value = cacheValue;
  }
};

const decrementCount = () => {
  if (countValue.value > 0) {
    countValue.value--;
  }
};

const incrementCount = () => {
  countValue.value++;
};

defineExpose({
  showModal,
  dismissModal,
});
</script>
<template>
  <dialog
    id="focus-item-details-dialog"
    ref="focus-item-details-dialog"
    class="modal"
  >
    <div class="modal-box">
      <div
        v-if="supplyItemStore.focusedItem"
        class="flex flex-col gap-4"
      >
        <div class="flex flex-row gap-4 items-start">
          <div class="flex justify-center">
            <div
              class="size-16 bg-secondary rounded-lg overflow-hidden flex items-center justify-center"
            >
              <img
                v-if="supplyItemStore.focusedItem.imageUrl"
                :src="supplyItemStore.focusedItem.imageUrl"
                width="128"
                height="128"
              />
              <CubeIcon
                v-else
                class="size-16 text-secondary-content"
              />
            </div>
          </div>

          <div class="text-left">
            <h3 class="text-lg font-bold">
              {{ supplyItemStore.focusedItem.name }}
            </h3>
            <p
              v-if="supplyItemStore.focusedItem.description"
              class="mt-2 text-sm"
            >
              {{ supplyItemStore.focusedItem.description }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-[auto_1fr_auto] gap-2">
          <button
            class="btn btn-secondary btn-square"
            @click.prevent="decrementCount"
          >
            <MinusIcon class="size-5" />
          </button>
          <input
            type="number"
            class="input w-full text-center"
            min="0"
            :value="countValue"
            @input="
              (event) => {
                event.preventDefault();
                updateCount((event.target as HTMLInputElement).value);
              }
            "
          />
          <button
            class="btn btn-secondary btn-square"
            @click.prevent="incrementCount"
          >
            <PlusIcon class="size-5" />
          </button>
        </div>
      </div>
      <div
        v-else
        class="py-4"
      >
        No item selected
      </div>

      <div class="modal-action">
        <form method="dialog">
          <button class="btn btn-outline btn-error">Cancel</button>
        </form>
        <button class="btn btn-primary">Update</button>
      </div>
    </div>
  </dialog>
</template>
