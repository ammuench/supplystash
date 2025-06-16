<script setup lang="ts">
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/vue/24/solid";
import { storeToRefs } from "pinia";

import { type Toast, useToastsStore } from "@/stores/toasts.store";

const toastStore = useToastsStore();
const { toasts } = storeToRefs(toastStore);

const handleRemoveToast = (toast: Toast) => {
  if (toast.dismissable) {
    toastStore.removeToast(toast.id);
  }
};

const getToastIcon = (toastStatus: Toast["status"]) => {
  switch (toastStatus) {
    case "error": {
      return XCircleIcon;
    }
    case "warning": {
      return ExclamationTriangleIcon;
    }
    case "success": {
      return CheckCircleIcon;
    }
    case "info": {
      return InformationCircleIcon;
    }
    case "base":
    default: {
      return undefined;
    }
  }
};
</script>

<template>
  <div class="pointer-events-none fixed left-0 top-0 z-[99] h-screen w-screen">
    <TransitionGroup
      name="list"
      tag="div"
      class="fixed right-0 top-0 flex h-[100dvh] w-full flex-col-reverse sm:h-screen sm:w-2/5 mobile:gap-1"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="c_toastWrapper !pointer-events-auto !relative whitespace-normal p-0 sm:p-4"
        @click="handleRemoveToast(toast)"
      >
        <div
          class="alert c_toast flex! flex-row gap-2"
          :class="{
            'alert-warning': toast.status === 'warning',
            'alert-success': toast.status === 'success',
            'alert-error': toast.status === 'error',
            'alert-info': toast.status === 'base' || toast.status === 'info',
          }"
        >
          <component
            :is="getToastIcon(toast.status)"
            v-if="getToastIcon(toast.status)"
            class="size-8"
          />
          <div class="w-full">
            <h5
              v-if="toast.title"
              class="font-semibold"
            >
              {{ toast.title }}
            </h5>
            <p>{{ toast.message }}</p>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
.list-move,
/* apply transition to moving elements */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* ensures leaving items are taken out of layout flow so that moving
   animations can be calculated correctly. */
.list-leave-active {
  position: absolute;
}

@media screen and (max-width: 640px) {
  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateX(0px) translateY(30px);
  }

  .c_toastWrapper:first-of-type {
    .c_toast {
      border-bottom-right-radius: 0px;
      border-bottom-left-radius: 0px;
    }
  }
}
</style>
