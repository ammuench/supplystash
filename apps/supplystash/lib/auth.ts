import type { AuthError, Session, User } from "@supabase/supabase-js";

import { AuthRetryableFetchError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

// A stable, provider-agnostic vocabulary of failures. Screens switch on `code`
// and never read supabase-js's own error shape, so adding OAuth later
// (`signInWithProvider`) needs no new result type and no new mapping.
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "invalid_email"
  | "network"
  | "unknown";

export type AuthFailure = { code: AuthErrorCode; message: string };

// Auth returns a result rather than throwing: a wrong password is an expected
// outcome of a form submit, and a screen should render it, not unmount into the
// error boundary.
export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthFailure };

export type AuthSuccess = { session: Session; user: User };

// supabase-js error codes, mapped to ours. Anything unlisted is `unknown` —
// deliberately, so an unrecognized backend code surfaces as a generic failure
// instead of being mislabelled as one we do understand.
const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "invalid_credentials",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  validation_failed: "invalid_email",
  email_address_invalid: "invalid_email",
  over_request_rate_limit: "network",
};

// Takes an `AuthError`, not an email-specific input, so every future auth
// method funnels through this one mapping.
const toAuthFailure = (error: AuthError): AuthFailure => ({
  code: (error.code && CODE_MAP[error.code]) ?? "unknown",
  message: error.message,
});

// Every method calls Supabase over the network, so a thrown fetch failure is as
// likely as a returned `error`. Both paths have to end in the same result type.
const toThrownFailure = (thrown: unknown): AuthFailure =>
  thrown instanceof AuthRetryableFetchError
    ? { code: "network", message: thrown.message }
    : {
        code: "unknown",
        message: thrown instanceof Error ? thrown.message : "Something went wrong.",
      };

// `enable_confirmations = false` in supabase/config.toml means sign-up returns a
// session immediately. If that ever changes, a caller holding `{ ok: true }`
// with no session would be a silent bug — fail closed instead, so the contract
// "success means you are signed in" always holds.
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
