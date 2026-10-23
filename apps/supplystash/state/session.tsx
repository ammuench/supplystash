import type { Session, User } from "@supabase/supabase-js";

import { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { consumeUserInitiatedSignOut } from "@/lib/auth";
import { queryCacheRestored } from "@/lib/query-cache-restore";
import { wipeAppQueryCache } from "@/lib/query-cache-wipe";
import { countPausedMutations, queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { toastInfo } from "@/lib/toast";

// Exported so the test asserts on the same string the user reads.
export const SESSION_EXPIRED_MESSAGE = "Your session expired — please sign in again.";

// The involuntary path cannot ask first, so the loss is reported instead.
export const sessionExpiredMessage = (discarded: number) =>
  discarded === 0
    ? SESSION_EXPIRED_MESSAGE
    : `Your session expired, and ${discarded} unsynced change${discarded === 1 ? " was" : "s were"} discarded — please sign in again.`;

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  // True until the persisted session has been read off disk. RootNavigator
  // renders null and SplashScreenController holds the splash until it flips.
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

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      settled = true;
      // Tear down here, not in the sign-out button, so token-expiry and remote
      // sign-outs get the same treatment. RLS filters server rows but does
      // nothing to the client cache — without this the next account to sign in
      // on the same process reads the previous user's cached rows.
      if (event === "SIGNED_OUT") {
        // Read before the clear empties the mutation cache. A deliberate
        // sign-out already confirmed this loss in the settings screen.
        const discarded = countPausedMutations(queryClient);
        queryClient.clear();
        // `clear()` only empties memory; the next account's boot pass would
        // restore these rows from disk. Started now rather than after the boot
        // pass: the pass reads every row up front, so deleting them mid-pass
        // changes nothing it does, and the clear below empties whatever it
        // writes to memory. It never rejects.
        void wipeAppQueryCache();
        // A sign-out during the boot read-cache pass (a refresh token rejected
        // at launch) would be undone by the rest of the pass writing the old
        // account's rows back. Clearing again once it settles is safe:
        // RootNavigator renders nothing until then, so no new account's data
        // can be in the cache yet. The pass never rejects. Mid-session the
        // pass settled long ago, so this finds nothing to clear.
        void queryCacheRestored.then(() => queryClient.clear());
        // Supabase emits this same event when a refresh token is rejected.
        // Unannounced, being bounced to sign-in mid-session reads as a crash or
        // a random logout. The deliberate path already toasts "Signed out", so
        // only the involuntary one is announced here.
        if (!consumeUserInitiatedSignOut()) {
          toastInfo(sessionExpiredMessage(discarded));
        }
      }
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
