import type { AuthError, Session, User } from "@supabase/supabase-js";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { oauthUrlFailure, paramsFromCallbackUrl } from "@/lib/auth-callback-url";
import { supabase } from "@/lib/supabase";

// Provider-agnostic, so OAuth slots in later without a new result type.
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "invalid_email"
  | "rate_limited"
  // The user closed the in-app browser before the provider redirected. Not a
  // failure to report — the screen should fall silent and let them try again.
  | "cancelled"
  | "network"
  | "unknown";

export type AuthFailure = { code: AuthErrorCode; message: string };

// A result, not a throw: a wrong password is a form outcome to render, not an
// error boundary to trip.
export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthFailure };

export type AuthSuccess = { session: Session; user: User };

// supabase-js codes, mapped to ours. Anything unlisted falls to `unknown`
// rather than the nearest-looking code — including `validation_failed`, which
// is generic parameter validation and would wrongly blame the email field.
const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "invalid_credentials",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  email_address_invalid: "invalid_email",
  // Throttling, not connectivity — the remedy is to wait, not to reconnect.
  over_request_rate_limit: "rate_limited",
};

// Takes an `AuthError`, not an email-specific input, so every future auth
// method funnels through this one mapping.
const toAuthFailure = (error: AuthError): AuthFailure => {
  // A dropped request is *returned*, not thrown: GoTrueClient catches its own
  // AuthRetryableFetchError and hands it back in `error`. It carries no `code`,
  // so without this check every offline attempt reads as `unknown`.
  if (isAuthRetryableFetchError(error)) {
    return { code: "network", message: error.message };
  }

  return { code: (error.code && CODE_MAP[error.code]) ?? "unknown", message: error.message };
};

// The client only rethrows what it does not recognize, so this is the residual
// path — it still routes through the same mapping to keep the codes identical.
const toThrownFailure = (thrown: unknown): AuthFailure => {
  if (isAuthRetryableFetchError(thrown)) {
    return { code: "network", message: thrown.message };
  }

  return {
    code: "unknown",
    message: thrown instanceof Error ? thrown.message : "Something went wrong.",
  };
};

// `enable_confirmations = false` (supabase/config.toml) means sign-up returns a
// session. Fail closed if that changes, so `ok: true` always means signed in.
const NO_SESSION: AuthFailure = {
  code: "unknown",
  message: "Signed up, but no session was returned.",
};

export const signUpWithEmail = async (
  email: string,
  password: string,
): Promise<AuthResult<AuthSuccess>> => {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { ok: false, error: toAuthFailure(error) };
    }
    if (!data.session || !data.user) {
      return { ok: false, error: NO_SESSION };
    }

    return { ok: true, data: { session: data.session, user: data.user } };
  } catch (thrown) {
    return { ok: false, error: toThrownFailure(thrown) };
  }
};

export const signInWithEmail = async (
  email: string,
  password: string,
): Promise<AuthResult<AuthSuccess>> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: toAuthFailure(error) };
    }

    return { ok: true, data: { session: data.session, user: data.user } };
  } catch (thrown) {
    return { ok: false, error: toThrownFailure(thrown) };
  }
};

export type OAuthProvider = "google" | "apple";

// The one path segment the OAuth callback owns. Kept a constant because it has
// to match `additional_redirect_urls` in supabase/config.toml exactly, and the
// route file name (app/auth-callback.tsx) that catches it on web.
//
// It is a *path*, not the root, because this scheme is shared: household invite
// deep links (supply-stash://invite/<token>) land on the same one later, and the
// architecture doc warns that separating them after the fact is painful.
export const AUTH_CALLBACK_PATH = "auth-callback";

// Web only: the page is navigating to the provider, so this process is about to
// be torn down and no session will ever come back through the promise. A
// success variant rather than a failure code, so no caller can render "We are
// redirecting you" as a red form error.
export type AuthRedirecting = { redirecting: true };

export const isRedirecting = (data: AuthSuccess | AuthRedirecting): data is AuthRedirecting =>
  "redirecting" in data;

// The exchange behind `completeOAuthCallback`, held by code. On Android the
// redirect can reach both callers — `openAuthSessionAsync` resolves with it
// *and* Expo Router opens app/auth-callback.tsx on the same deep link — and a
// code is single-use, so a second exchange would fail and report an error over
// a sign-in that succeeded. Handing the second caller the first one's promise
// gives both the same outcome.
let inflightExchange: { code: string; result: Promise<AuthResult<AuthSuccess>> } | null = null;

const exchangeCode = async (code: string): Promise<AuthResult<AuthSuccess>> => {
  try {
    // The PKCE verifier this needs was stashed by `signInWithOAuth` when the
    // sign-in started — LargeSecureStore on native, localStorage on web — which
    // is exactly why intercepting the callback URL alone buys an attacker
    // nothing, and why this still works after a cold start. This is what
    // persists the session and fires the SIGNED_IN that state/session.tsx is
    // waiting on.
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, error: toAuthFailure(error) };
    }
    // Not NO_SESSION: that one's wording is sign-up specific.
    if (!data.session || !data.user) {
      return { ok: false, error: { code: "unknown", message: "No session was returned." } };
    }

    return { ok: true, data: { session: data.session, user: data.user } };
  } catch (thrown) {
    return { ok: false, error: toThrownFailure(thrown) };
  }
};

/**
 * Turns an OAuth callback URL into a session.
 *
 * The one handler for every way that URL can reach us, which is the shape
 * Supabase's own React Native guide prescribes: the native
 * `openAuthSessionAsync` round trip below hands it `result.url`, and
 * app/auth-callback.tsx hands it the web redirect or a native cold-start deep
 * link. All of them need the identical provider-error, missing-code and
 * exchange handling, so none of them owns it.
 */
export const completeOAuthCallback = async (url: string): Promise<AuthResult<AuthSuccess>> => {
  const params = paramsFromCallbackUrl(url);

  const providerError = params.get("error");
  if (providerError) {
    return { ok: false, error: oauthUrlFailure(providerError, params.get("error_description")) };
  }

  const code = params.get("code");
  if (!code) {
    return { ok: false, error: { code: "unknown", message: "No session was returned." } };
  }

  if (inflightExchange?.code !== code) {
    inflightExchange = { code, result: exchangeCode(code) };
  }

  return await inflightExchange.result;
};

// No provider is enabled yet (STASH-23 / STASH-24 supply the credentials), so
// nothing calls this outside tests.
export const signInWithProvider = async (
  provider: OAuthProvider,
): Promise<AuthResult<AuthSuccess | AuthRedirecting>> => {
  try {
    // A new sign-in brings a new code, so the last one's exchange is done with.
    inflightExchange = null;
    const redirectTo = Linking.createURL(AUTH_CALLBACK_PATH);

    // Web is a redirect, not a round trip: supabase-js navigates the whole page
    // to the provider, this process ends, and the code is exchanged on the next
    // load by app/auth-callback.tsx.
    // So there is nothing to await and no session to return — only the failure
    // to start the redirect at all is reportable. Callers distinguish this from
    // a real sign-in with `isRedirecting`.
    if (Platform.OS === "web") {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) {
        return { ok: false, error: toAuthFailure(error) };
      }

      return { ok: true, data: { redirecting: true } };
    }

    // `skipBrowserRedirect` because there is no window to navigate on native —
    // we want the URL handed back so it can be opened in an auth session
    // instead.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      return { ok: false, error: toAuthFailure(error) };
    }
    if (!data.url) {
      return { ok: false, error: { code: "unknown", message: "No provider URL was returned." } };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    // `dismiss` is the iOS swipe-down, `cancel` the explicit Done button; both
    // mean the user backed out. Anything else is a browser that never opened.
    if (result.type === "cancel" || result.type === "dismiss") {
      return { ok: false, error: { code: "cancelled", message: "Sign-in was cancelled." } };
    }
    if (result.type !== "success") {
      return { ok: false, error: { code: "unknown", message: "The sign-in browser closed." } };
    }

    return await completeOAuthCallback(result.url);
  } catch (thrown) {
    return { ok: false, error: toThrownFailure(thrown) };
  }
};

// A deliberate sign-out and a rejected refresh token both reach
// `onAuthStateChange` as the same `SIGNED_OUT` event, and only the caller knows
// which it is. `signOut` leaves a mark here for the listener to read.
let userInitiatedSignOut = false;

/**
 * True if the `SIGNED_OUT` about to be handled came from `signOut`. Reading it
 * clears it, so a later involuntary sign-out is not mistaken for this one.
 */
export const consumeUserInitiatedSignOut = () => {
  const wasUserInitiated = userInitiatedSignOut;
  userInitiatedSignOut = false;

  return wasUserInitiated;
};

export const signOut = async (): Promise<AuthResult<null>> => {
  // Set before the call, not after: supabase emits the event from inside
  // `signOut`, so a mark set afterwards would arrive too late to be read.
  userInitiatedSignOut = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // No event fired, so the mark would otherwise sit here and swallow the
      // expired-session notice on whatever involuntary sign-out comes next.
      userInitiatedSignOut = false;

      return { ok: false, error: toAuthFailure(error) };
    }

    return { ok: true, data: null };
  } catch (thrown) {
    userInitiatedSignOut = false;

    return { ok: false, error: toThrownFailure(thrown) };
  }
};
