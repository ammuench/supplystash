<script setup lang="ts">
defineProps<{
  showNotifications: boolean;
  toggleNotifications: () => void;
}>();
</script>
<template>
  <div
    class="fixed top-0 left-0 z-40 w-screen h-dvh bg-black opacity-30"
    role="button"
    aria-label="dismiss notifications panel"
    :class="{
      'pointer-events-none': !showNotifications,
      hidden: !showNotifications,
    }"
    @click="toggleNotifications"
  ></div>
  <div
    class="fixed top-0 right-0 z-40 h-dvh translate-x-full pt-[4.5rem] transition-transform"
    :class="{ '!translate-x-0': $props.showNotifications }"
  >
    <ul class="menu bg-base-300 text-base-content min-h-full w-80 py-8 px-4">
      <li>notifications will be here</li>
    </ul>
  </div>
</template>
