<script setup lang="ts">
import type { SupplyItem } from "@supplystash/types";

defineProps<{ item: SupplyItem }>();
</script>
<template>
  <div class="card card-border bg-base-300">
    <div class="card-body p-3">
      <div class="flex flex-row gap-4 items-center">
        <div class="size-12 bg-secondary rounded-lg overflow-hidden">
          <img
            v-if="$props.item.imageUrl"
            :src="$props.item.imageUrl"
            width="48"
            height="48"
          />
        </div>
        <div>
          <h2 class="font-bold truncate">{{ $props.item.name }}</h2>
        </div>
      </div>
    </div>
  </div>
</template>
