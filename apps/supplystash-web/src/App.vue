<script setup lang="ts">
import { themeChange } from "theme-change";
import { onMounted } from "vue";
import { RouterView } from "vue-router";

import NavBar from "@/components/NavBar.vue";

onMounted(() => {
  themeChange(false);
});
</script>

<template>
  <main class="grid h-dvh grid-cols-1 grid-rows-[auto_1fr]">
    <NavBar />
    <RouterView />
  </main>
</template>
