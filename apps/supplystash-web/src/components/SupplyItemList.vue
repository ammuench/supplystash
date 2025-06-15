<script setup lang="ts">
import { CubeIcon } from "@heroicons/vue/24/outline";
import type { SupplyItem } from "@supplystash/types";
import { computed } from "vue";

const props = defineProps<{
  item: SupplyItem;
  onSelect: (item: SupplyItem) => void;
}>();

const countStatus = computed(() => {
  if (props.item.current_inventory === props.item.warning_amount) {
    return "warn" as const;
  } else if (props.item.current_inventory < props.item.warning_amount) {
    return "error" as const;
  } else {
    return "ok" as const;
  }
});
</script>
<template>
  <button
    class="card card-border bg-base-300 cursor-pointer"
    @click="
      () => {
        $props.onSelect($props.item);
      }
    "
  >
    <div class="card-body p-3">
      <div class="flex flex-row gap-4 items-center">
        <div
          class="size-12 bg-secondary rounded-lg overflow-hidden flex items-center justify-center"
        >
          <img
            v-if="$props.item.photo_url"
            :src="$props.item.photo_url"
            width="48"
            height="48"
          />
          <CubeIcon
            v-else
            class="size-8 text-secondary-content"
          />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="font-bold truncate text-left">{{ $props.item.title }}</h2>
          <p
            v-if="$props.item.description"
            class="truncate text-sm text-left"
          >
            {{ $props.item.description }}
          </p>
        </div>
        <div class="flex-shrink-0">
          <span
            class="badge"
            :class="{
              'badge-warning': countStatus === 'warn',
              'badge-error': countStatus === 'error',
              'badge-success': countStatus === 'ok',
            }"
          >
            {{ $props.item.current_inventory }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>
