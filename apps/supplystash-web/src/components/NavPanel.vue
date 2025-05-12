<script setup lang="ts">
import { NAV_LINKS } from "@/constants/NavLinks";

import NavBarIcon from "./NavBarIcon.vue";

defineProps<{
  showSidebar: boolean;
  toggleSidebar: () => void;
}>();
</script>

<template>
  <div
    class="fixed top-0 left-0 z-40 w-screen h-dvh bg-black opacity-30"
    role="button"
    aria-label="dismiss notifications panel"
    :class="{'pointer-events-none': !showSidebar, 'hidden': !showSidebar}"
    @click="toggleSidebar"
  ></div>
  <div
    class="bg-base-300 text-base-content fixed top-0 left-0 z-40 h-dvh -translate-x-full pt-20 transition-transform"
    :class="{ 'translate-x-0': showSidebar }"
  >
    <ul class="menu min-h-full w-80 p-4">
      <!-- Sidebar content here -->
      <li
        v-for="link in NAV_LINKS"
        :key="link.link"
      >
        <RouterLink
          v-if="!link.external"
          :to="link.link"
          class="text-2xl"
          @click="toggleSidebar"
        >
          <NavBarIcon
            :icon-name="link.icon"
            class="text-base-content size-6 p-0"
          />
          <span>{{ link.display }}</span>
        </RouterLink>
        <a
          v-else
          :href="link.link"
        >
          {{ link.display }}
        </a>
      </li>
    </ul>

    <div></div>
  </div>
</template>
