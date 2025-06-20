<script setup lang="ts">
import { CubeIcon, MinusIcon, PlusIcon } from "@heroicons/vue/24/outline";
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from "vue";

import { useItemAmountUpdater } from "@/composables/useItemAmountUpdater";

import { useToastsStore } from "@/stores/toasts.store";

import { useSupplyItemStore } from "../stores/supplyItem.store";

const supplyItemStore = useSupplyItemStore();
const { createToast } = useToastsStore();

const focusDialog = useTemplateRef("focus-item-details-dialog");

const focusedItem = computed(() => {
  if (supplyItemStore.focusedItem) {
    return supplyItemStore.items.find(
      (item) => item.id === supplyItemStore.focusedItem
    );
  }

  return undefined;
});

const showModal = () => {
  if (focusedItem.value) {
    countValue.value = focusedItem.value.current_inventory;
  }
  focusDialog.value?.showModal();
};

const {
  clearError,
  updateItem,
  isLoading,
  error: updateError,
} = useItemAmountUpdater();

const clearErrorWithCloseDelay = () => {
  setTimeout(() => {
    clearError();
  }, 500);
};

const dismissModal = () => {
  focusDialog.value?.close();
  clearErrorWithCloseDelay();
};

const countValue = ref<number>(0);

const handleUpdateItem = async () => {
  if (focusedItem.value) {
    await updateItem(focusedItem.value.id, countValue.value);
    dismissModal();
    createToast({
      id: `${focusedItem.value.id}__amtUpdateLocal`,
      dismissable: true,
      duration: 1500,
      message: `Updated ${focusedItem.value.title} count`,
      status: "success",
    });
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

onMounted(() => {
  focusDialog.value?.addEventListener("close", clearErrorWithCloseDelay);
});

onUnmounted(() => {
  focusDialog.value?.removeEventListener("close", clearErrorWithCloseDelay);
});
</script>
<template>
  <dialog
    id="focus-item-details-dialog"
    ref="focus-item-details-dialog"
    class="modal scrollbar-stable"
  >
    <div class="modal-box">
      <div
        v-if="focusedItem"
        class="flex flex-col gap-4"
      >
        <div class="flex flex-row gap-4 items-start">
          <div class="flex justify-center">
            <div
              class="size-16 bg-secondary rounded-lg overflow-hidden flex items-center justify-center"
            >
              <img
                v-if="focusedItem.photo_url"
                :src="focusedItem.photo_url"
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
              {{ focusedItem.title }}
            </h3>
            <p
              v-if="focusedItem.description"
              class="mt-2 text-sm"
            >
              {{ focusedItem.description }}
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
                countValue = parseInt((event.target as HTMLInputElement).value);
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

      <div class="modal-action flex-col alert-info-end">
        <div v-if="updateError">
          <p class="text-right text-sm text-error">{{ updateError }}</p>
        </div>
        <div class="flex flex-row gap-2 justify-end">
          <form
            method="dialog"
            :disabled="isLoading"
          >
            <button
              class="btn btn-outline btn-error"
              :disabled="isLoading"
              @click="clearErrorWithCloseDelay"
            >
              Cancel
            </button>
          </form>
          <button
            class="btn btn-primary"
            :disabled="isLoading"
            @click="handleUpdateItem"
          >
            <span
              v-if="isLoading"
              class="loading loading-spinner"
            ></span>
            Update
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>

<style lang="css" scoped>
.scrollbar-stable {
  scrollbar-gutter: auto;
}
</style>
