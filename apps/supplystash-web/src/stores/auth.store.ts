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

  return { session, loading, isLoggedIn, initialize };
});
