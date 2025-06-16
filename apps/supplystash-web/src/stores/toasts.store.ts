import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { ref } from "vue";

export type ToastStatus = "info" | "success" | "warning" | "error" | "base";

export type ToastParams = {
  id?: string;
  title?: string;
  message: string;
  status: ToastStatus;
  duration?: number;
  dismissable?: boolean;
};

export type Toast = {
  title?: string;
  message: string;
  status: ToastStatus;
  duration?: number;
  id: string;
  dismissable?: boolean;
};

const DEFAULT_TOAST_DURATION = 3000;

export const useToastsStore = defineStore("toasts", () => {
  const toasts = ref<Toast[]>([]);
  const createToast = (toastParams: ToastParams) => {
    const toastid = toastParams.id || uuidv4();
    toasts.value.push({
      ...toastParams,
      id: toastid,
    });
    setTimeout(() => {
      removeToast(toastid);
    }, toastParams.duration || DEFAULT_TOAST_DURATION);
  };

  const removeToast = (toastId: string) => {
    const updatedArray = toasts.value.filter((toast) => toast.id !== toastId);
    toasts.value = updatedArray;
  };

  return {
    toasts,
    createToast,
    removeToast,
  };
});
