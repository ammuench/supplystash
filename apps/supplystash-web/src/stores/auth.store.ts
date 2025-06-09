import router from "@/router";
import type { Session } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { supabase } from "@/utils/supabase";

export const useAuthStore = defineStore("auth", () => {
  const session = ref<Session | null>(null);
  const loading = ref(true);

  const isLoggedIn = computed(() => {
    return !!session.value;
  });

  async function initialize() {
    const { data } = await supabase.auth.getSession();
    session.value = data.session;
    loading.value = false;

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession;
    });
  }

  async function login({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    if (!email || !password) {
      throw new Error("Must provide an email and password");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    session.value = data.session;
    return data.session;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    session.value = null;

    if (error) {
      throw error;
    }

    router.push({ name: "sign-in", query: { isLogoutEvent: "true" } });
  }

  return { session, loading, isLoggedIn, initialize, login, logout };
});
