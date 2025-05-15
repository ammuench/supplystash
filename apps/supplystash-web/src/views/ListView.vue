<script setup lang="ts">
import type { SupplyItem } from "@supplystash/types";
import { useFetch } from "@vueuse/core";
import { watch } from "vue";

import SupplyItemList from "@/components/SupplyItemList.vue";

// TODO: Set this to use an actual API
const { isFetching, data } = useFetch<{ items: SupplyItem[] }>(
  "http://localhost:3000/items"
).json();

watch(data, () => {
  console.log(data.value);
});
</script>

<template>
  <div class="h-full overflow-y-scroll max-w-screen px-4 py-2">
    <div class="flex flex-col gap-2 min-h-full pb-64">
      <div v-if="isFetching || data === null">Loading....</div>
      <SupplyItemList
        v-for="supplyItem in data?.items"
        :key="supplyItem.id"
        :item="supplyItem"
      />
    </div>
  </div>
</template>
