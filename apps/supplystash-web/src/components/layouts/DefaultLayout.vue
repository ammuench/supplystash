<script setup lang="ts">
defineProps<{
  class?: string;
}>();
</script>

<template>
  <div
    :class="`h-full overflow-y-auto max-w-screen px-4 py-2 scrollbar-thin ${$props.class || ''}`"
  >
    <slot />
  </div>
</template>

<style lang="css" scoped>
.scrollbar-thin {
  scrollbar-width: thin;
}
</style>
