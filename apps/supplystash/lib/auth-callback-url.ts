import type { AuthFailure } from "@/lib/auth";

// Supabase appends PKCE's `code` as a query parameter and provider errors as
// either half depending on the provider. Split by hand rather than with
// `new URL`: the native redirect uses a custom scheme, which URL
// implementations treat as opaque and inconsistently expose a `hash` for. Both
// halves are still parsed as real parameters.
export const paramsFromCallbackUrl = (url: string) => {
  const [withoutFragment, fragment = ""] = url.split("#");
  const query = withoutFragment.split("?")[1] ?? "";

  return new URLSearchParams(`${query}&${fragment}`);
};

// Provider errors arrive as URL parameters, not as an AuthError, so there is no
// instance to hand `toAuthFailure`. `access_denied` is the provider's word for
// the user declining at the consent screen, which is the same outcome as
// closing the browser.
export const oauthUrlFailure = (error: string, description: string | null): AuthFailure => ({
  code: error === "access_denied" ? "cancelled" : "unknown",
  message: description ?? error,
});
