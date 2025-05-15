<script setup lang="ts">
import { CubeIcon } from "@heroicons/vue/24/outline";
import type { SupplyItem } from "@supplystash/types";

defineProps<{ item: SupplyItem }>();
</script>
<template>
  <div class="card card-border bg-base-300">
    <div class="card-body p-3">
      <div class="flex flex-row gap-4 items-center">
        <div
          class="size-12 bg-secondary rounded-lg overflow-hidden flex items-center justify-center"
        >
          <img
            v-if="$props.item.imageUrl"
            :src="$props.item.imageUrl"
            width="48"
            height="48"
          />
          <CubeIcon
            v-else
            class="size-8 text-secondary-content"
          />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="font-bold truncate">{{ $props.item.name }}</h2>
          <p class="truncate text-sm">{{ $props.item.description }}</p>
        </div>
        <div class="flex-shrink-0">
          <span class="badge badge-primary">{{
            $props.item.currentCount
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
