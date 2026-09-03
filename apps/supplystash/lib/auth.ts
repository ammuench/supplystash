import type { AuthError, Session, User } from "@supabase/supabase-js";

import { AuthRetryableFetchError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

// Provider-agnostic, so OAuth slots in later without a new result type.
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "invalid_email"
  | "rate_limited"
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
const toAuthFailure = (error: AuthError): AuthFailure => ({
  code: (error.code && CODE_MAP[error.code]) ?? "unknown",
  message: error.message,
});

// A thrown fetch failure has to land in the same result type as a returned one.
const toThrownFailure = (thrown: unknown): AuthFailure =>
  thrown instanceof AuthRetryableFetchError
    ? { code: "network", message: thrown.message }
    : {
        code: "unknown",
        message: thrown instanceof Error ? thrown.message : "Something went wrong.",
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

export const signOut = async (): Promise<AuthResult<null>> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { ok: false, error: toAuthFailure(error) };
    }

    return { ok: true, data: null };
  } catch (thrown) {
    return { ok: false, error: toThrownFailure(thrown) };
  }
};
