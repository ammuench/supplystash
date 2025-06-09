import { createPinia } from "pinia";
import { createApp } from "vue";

import { useAuthStore } from "@/stores/auth.store";

import App from "./App.vue";
import "./assets/main.css";
import router from "./router";

async function init() {
  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.use(router);

  const authStore = useAuthStore();
  await authStore.initialize();

  app.mount("#app");
}

init();
