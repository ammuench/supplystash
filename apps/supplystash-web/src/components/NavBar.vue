<script setup lang="ts">
import { ref } from "vue";

import NavPanel from "./NavPanel.vue";
import NotificationsPanel from "./NotificationsPanel.vue";

const showSidebar = ref(false);
const showNotifs = ref(false);
const toggleSidebar = () => {
  if (showNotifs.value) {
    showNotifs.value = false;
  }
  showSidebar.value = !showSidebar.value;
};
const toggleNotifs = () => {
  if (showSidebar.value) {
    showSidebar.value = false;
  }
  showNotifs.value = !showNotifs.value;
};
</script>
<template>
  <div
    class="bg-transparent z-50 p-2 transition-colors ease-in"
    :class="{ 'bg-primary': showSidebar || showNotifs }"
  >
    <header
      class="navbar !min-h-14 bg-primary text-primary-content sticky top-0 rounded-2xl"
      :class="{ 'shadow-sm': !showSidebar && !showNotifs }"
    >
      <div class="navbar-start">
        <button
          class="btn btn-ghost btn-circle"
          @click="toggleSidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
        </button>
      </div>
      <div class="navbar-center">
        <a class="btn btn-ghost text-xl">supplystash</a>
      </div>
      <div class="navbar-end">
        <button
          class="btn btn-ghost btn-circle"
          @click="toggleNotifs"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"
            />
          </svg>
        </button>
      </div>
    </header>
  </div>
  <NavPanel
    :show-sidebar="showSidebar"
    :toggle-sidebar="toggleSidebar"
  />
  <NotificationsPanel
    :show-notifications="showNotifs"
    :toggle-notifications="toggleNotifs"
  />
</template>
