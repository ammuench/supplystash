import type { Session, User } from "@supabase/supabase-js";

import { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  // True until the persisted session has been read off disk. The splash hold
  // (STASH-19) consumes this; nothing gates on it yet.
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // `getSession` reads (and decrypts) from storage, so it can resolve after
    // `onAuthStateChange` has already delivered a newer session. Only let the
    // initial read win if nothing has arrived ahead of it.
    let settled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      settled = true;
      setSession(nextSession);
      setIsLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!settled) {
          setSession(data.session);
          setIsLoading(false);
        }
      })
      .catch(() => {
        // Reading the session decrypts it, which throws if the ciphertext or
        // its SecureStore key is corrupt. Settling to signed-out costs the user
        // a re-login; leaving `isLoading` true would hold the splash forever,
        // with no way out but a reinstall.
        if (!settled) {
          setSession(null);
          setIsLoading(false);
        }
      });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Native only: the token refresh timer does not run while the app is
    // backgrounded, so without this the app resumes on an expired access token
    // and the first query 401s. On web the tab keeps its own timers.
    if (Platform.OS === "web") {
      return;
    }

    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    });

    return () => listener.remove();
  }, []);

  return (
    <SessionContext.Provider value={{ session, user: session?.user ?? null, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
};
