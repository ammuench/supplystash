<script setup lang="ts">
import { MoonIcon, SunIcon } from "@heroicons/vue/24/outline";
import { ref } from "vue";

import { NAV_LINKS } from "@/constants/NavLinks";

defineProps<{
  showSidebar: boolean;
  toggleSidebar: () => void;
}>();

type ColorThemes = "coffee" | "bumblebee";

const htmlTheme =
  localStorage.getItem("theme")?.trim() ||
  (document.querySelector("html")?.getAttribute("data-theme")?.trim() as
    | ColorThemes
    | undefined);

const isDarkMode = ref<boolean>(htmlTheme === "coffee");

if (
  htmlTheme === "coffee" ||
  (window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  if (htmlTheme === undefined) {
    isDarkMode.value = true;
  }
}

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};
</script>

<template>
  <div
    class="fixed top-0 left-0 z-40 w-screen h-dvh bg-black opacity-30"
    role="button"
    aria-label="dismiss notifications panel"
    :class="{ 'pointer-events-none': !showSidebar, hidden: !showSidebar }"
    @click="toggleSidebar"
  ></div>
  <div
    class="bg-base-300 text-base-content fixed top-0 left-0 z-40 h-dvh -translate-x-full pt-[4.5rem] transition-transform"
    :class="{ 'translate-x-0': showSidebar }"
  >
    <ul class="menu min-h-full w-80 py-4 px-2">
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
          <component
            :is="link.icon"
            class="text-base-content size-6 p-0"
          />
          <span>{{ link.display }}</span>
        </RouterLink>
        <a
          v-else
          class="text-2xl"
          :href="link.link"
        >
          {{ link.display }}
        </a>
      </li>
      <li></li>
      <li>
        <button
          ref="theme-toggle"
          data-toggle-theme="bumblebee, coffee"
          data-act-class="ACTIVECLASS"
          @click="toggleTheme"
        >
          <!-- sun icon -->
          <SunIcon
            v-if="!isDarkMode"
            class="swap-off size-6 fill-current"
          />

          <!-- moon icon -->
          <MoonIcon
            v-if="isDarkMode"
            class="swap-on size-6 fill-current"
          />
          <span class="text-2xl">Theme</span>
        </button>
      </li>
    </ul>
  </div>
</template>
