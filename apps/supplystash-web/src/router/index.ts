import { createRouter, createWebHistory } from "vue-router";

import HomeView from "@/views/HomeView.vue";
import ListView from "@/views/ListView.vue";
import SignInView from "@/views/SignInView.vue";
import SignUpView from "@/views/SignUpView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/list",
      name: "list",
      component: ListView,
    },
    {
      path: "/sign-up",
      name: "sign-up",
      component: SignUpView,
    },
    {
      path: "/sign-in",
      name: "sign-in",
      component: SignInView,
    },
  ],
});

export default router;
