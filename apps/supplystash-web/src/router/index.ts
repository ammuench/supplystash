import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "@/stores/auth.store";

import HomeView from "@/views/HomeView.vue";
import ListView from "@/views/ListView.vue";
import SignInView from "@/views/SignInView.vue";
import SignUpView from "@/views/SignUpView.vue";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    redirectIfAuthed?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // TODO: Figure out home route split between auth/non-auth
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: "/list",
      name: "list",
      component: ListView,
      meta: { requiresAuth: true },
    },
    {
      path: "/sign-up",
      name: "sign-up",
      component: SignUpView,
      meta: { redirectIfAuthed: true },
    },
    {
      path: "/sign-in",
      name: "sign-in",
      component: SignInView,
      meta: { redirectIfAuthed: true },
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: "sign-in", query: { fromRedirect: "true" } };
  }

  if (to.meta.redirectIfAuthed && authStore.isLoggedIn) {
    return { name: "home" };
  }
});

export default router;
