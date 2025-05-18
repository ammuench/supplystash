<script setup lang="ts">
import { useTemplateRef } from "vue";

const focusDialog = useTemplateRef("focus-item-details-dialog");

const showModal = () => {
  focusDialog.value?.showModal();
};

const dismissModal = () => {
  focusDialog.value?.close();
};

defineExpose({
  showModal,
  dismissModal,
});
</script>
<template>
  <dialog
    ref="focus-item-details-dialog"
    id="focus-item-details-dialog"
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
</template>
