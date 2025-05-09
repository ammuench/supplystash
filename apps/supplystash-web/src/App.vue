<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import NavBar from "@/components/NavBar.vue";
</script>

<template>
  <main class="h-dvh grid grid-cols-1 grid-rows-[auto_1fr]">
    <NavBar />
    <RouterView />
  </main>
</template>
