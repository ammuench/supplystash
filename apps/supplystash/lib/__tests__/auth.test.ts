import type { Session, User } from "@supabase/supabase-js";

import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import {
  consumeUserInitiatedSignOut,
  signInWithEmail,
  signInWithProvider,
  signOut,
  signUpWithEmail,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// `lib/supabase` is mocked rather than the network: these wrappers own the
// mapping from supabase-js's shape to ours, and that is all this suite asserts.
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      setSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const openAuthSession = jest.mocked(WebBrowser.openAuthSessionAsync);

const REDIRECT_URL = "supply-stash://auth-callback";
const PROVIDER_URL = "https://accounts.google.com/o/oauth2/auth?client_id=x";

// What the provider appends to the redirect on the way back.
const callbackUrl = (fragment: string) => `${REDIRECT_URL}#${fragment}`;
const TOKENS = "access_token=header.payload.signature&refresh_token=refresh";

const providerReturns = (url: string) => {
  auth.signInWithOAuth.mockResolvedValue({ data: { url: PROVIDER_URL }, error: null } as never);
  openAuthSession.mockResolvedValue({ type: "success", url } as never);
};

const USER = { id: "00000000-0000-0000-0000-000000000000" } as User;
const SESSION = { access_token: "header.payload.signature", user: USER } as Session;

// supabase-js reports a bad password as an AuthApiError carrying a `code`.
const apiError = (code: string, message: string) => new AuthApiError(message, 400, code);

// GoTrueClient catches this one itself and returns it in `error`, so it reaches
// the mapper with no `code` at all — the shape an offline device produces.
const OFFLINE = new AuthRetryableFetchError("Network request failed", 0);

beforeEach(() => {
  jest.clearAllMocks();
  // The sign-out mark lives at module scope, so drain it between tests.
  consumeUserInitiatedSignOut();
});

describe("# auth", () => {
  describe("## signInWithEmail", () => {
    it("returns the session, so the caller never has to re-read it from storage", async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: SESSION, user: USER },
        error: null,
      } as never);

      const result = await signInWithEmail("a@example.com", "hunter2hunter2");

      expect(result).toEqual({ ok: true, data: { session: SESSION, user: USER } });
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: "a@example.com",
        password: "hunter2hunter2",
      });
    });

    it("maps a wrong password to a stable code instead of throwing at the screen", async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: apiError("invalid_credentials", "Invalid login credentials"),
      } as never);

      const result = await signInWithEmail("a@example.com", "wrong");

      expect(result).toEqual({
        ok: false,
        error: { code: "invalid_credentials", message: "Invalid login credentials" },
      });
    });

    it("reports an unrecognized backend code as unknown rather than guessing", async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: apiError("some_future_code", "Nope"),
      } as never);

      const result = await signInWithEmail("a@example.com", "hunter2hunter2");

      expect(result).toEqual({ ok: false, error: { code: "unknown", message: "Nope" } });
    });

    it("distinguishes throttling from a network failure, as the remedy differs", async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: apiError("over_request_rate_limit", "Request rate limit reached"),
      } as never);

      const result = await signInWithEmail("a@example.com", "hunter2hunter2");

      expect(result).toMatchObject({ ok: false, error: { code: "rate_limited" } });
    });

    it("does not blame the email field for a generic parameter validation failure", async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: apiError("validation_failed", "Validation failed"),
      } as never);

      const result = await signInWithEmail("a@example.com", "hunter2hunter2");

      expect(result).toMatchObject({ ok: false, error: { code: "unknown" } });
    });

    it("points at the email field when the address itself is rejected", async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: apiError("email_address_invalid", "Email address is invalid"),
      } as never);

      const result = await signInWithEmail("nope", "hunter2hunter2");

      expect(result).toMatchObject({ ok: false, error: { code: "invalid_email" } });
    });

    it("reports an offline attempt as network, not as an unexplained failure", async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: OFFLINE,
      } as never);

      const result = await signInWithEmail("a@example.com", "hunter2hunter2");

      expect(result).toEqual({
        ok: false,
        error: { code: "network", message: "Network request failed" },
      });
    });

    it("still maps a fetch failure that escapes the client as a throw", async () => {
      auth.signInWithPassword.mockRejectedValue(OFFLINE);

      const result = await signInWithEmail("a@example.com", "hunter2hunter2");

      expect(result).toMatchObject({ ok: false, error: { code: "network" } });
    });
  });

  describe("## signUpWithEmail", () => {
    it("returns a session, since confirmations are disabled in config.toml", async () => {
      auth.signUp.mockResolvedValue({
        data: { session: SESSION, user: USER },
        error: null,
      } as never);

      const result = await signUpWithEmail("new@example.com", "hunter2hunter2");

      expect(result).toEqual({ ok: true, data: { session: SESSION, user: USER } });
    });

    it("maps a taken email so the screen can point at the sign-in tab", async () => {
      auth.signUp.mockResolvedValue({
        data: { session: null, user: null },
        error: apiError("user_already_exists", "User already registered"),
      } as never);

      const result = await signUpWithEmail("taken@example.com", "hunter2hunter2");

      expect(result).toMatchObject({ ok: false, error: { code: "email_taken" } });
    });

    it("reports an offline attempt as network, matching sign-in", async () => {
      auth.signUp.mockResolvedValue({
        data: { session: null, user: null },
        error: OFFLINE,
      } as never);

      expect(await signUpWithEmail("new@example.com", "hunter2hunter2")).toMatchObject({
        ok: false,
        error: { code: "network" },
      });
    });

    it("fails closed when no session comes back, rather than reporting a signed-out success", async () => {
      auth.signUp.mockResolvedValue({ data: { session: null, user: USER }, error: null } as never);

      const result = await signUpWithEmail("new@example.com", "hunter2hunter2");

      expect(result).toMatchObject({ ok: false, error: { code: "unknown" } });
    });
  });

  describe("## signInWithProvider", () => {
    describe("### native", () => {
      it("returns the session, so the caller never has to re-read it from storage", async () => {
        providerReturns(callbackUrl(TOKENS));
        auth.setSession.mockResolvedValue({
          data: { session: SESSION, user: USER },
          error: null,
        } as never);

        const result = await signInWithProvider("google");

        expect(result).toEqual({ ok: true, data: { session: SESSION, user: USER } });
        expect(auth.setSession).toHaveBeenCalledWith({
          access_token: "header.payload.signature",
          refresh_token: "refresh",
        });
      });

      it("opens the provider URL against the same redirect it asked Supabase for", async () => {
        providerReturns(callbackUrl(TOKENS));
        auth.setSession.mockResolvedValue({
          data: { session: SESSION, user: USER },
          error: null,
        } as never);

        await signInWithProvider("google");

        expect(auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: "google",
          options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
        });
        expect(openAuthSession).toHaveBeenCalledWith(PROVIDER_URL, REDIRECT_URL);
      });

      it("maps a dismissed browser to cancelled, so the screen can stay silent", async () => {
        auth.signInWithOAuth.mockResolvedValue({
          data: { url: PROVIDER_URL },
          error: null,
        } as never);
        openAuthSession.mockResolvedValue({ type: "dismiss" } as never);

        const result = await signInWithProvider("google");

        expect(result).toMatchObject({ ok: false, error: { code: "cancelled" } });
        expect(auth.setSession).not.toHaveBeenCalled();
      });

      // The provider reports a declined consent screen in the URL, not as an
      // AuthError, so it takes its own mapping to reach the same code.
      it("treats a declined consent screen as cancelled rather than a failure", async () => {
        providerReturns(`${REDIRECT_URL}?error=access_denied&error_description=User+said+no`);

        const result = await signInWithProvider("google");

        expect(result).toEqual({
          ok: false,
          error: { code: "cancelled", message: "User said no" },
        });
      });

      it("reports any other provider error rather than guessing at its meaning", async () => {
        providerReturns(`${REDIRECT_URL}?error=server_error&error_description=Boom`);

        expect(await signInWithProvider("google")).toEqual({
          ok: false,
          error: { code: "unknown", message: "Boom" },
        });
      });

      it("refuses a callback carrying no tokens instead of reporting a signed-in success", async () => {
        providerReturns(callbackUrl("token_type=bearer"));

        expect(await signInWithProvider("google")).toMatchObject({
          ok: false,
          error: { code: "unknown" },
        });
        expect(auth.setSession).not.toHaveBeenCalled();
      });

      it("reports an offline attempt as network, matching the email methods", async () => {
        auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: OFFLINE } as never);

        expect(await signInWithProvider("google")).toMatchObject({
          ok: false,
          error: { code: "network" },
        });
        expect(openAuthSession).not.toHaveBeenCalled();
      });

      it("surfaces a rejected setSession instead of leaving the caller signed out silently", async () => {
        providerReturns(callbackUrl(TOKENS));
        auth.setSession.mockResolvedValue({
          data: { session: null, user: null },
          error: apiError("unexpected_failure", "Boom"),
        } as never);

        expect(await signInWithProvider("google")).toEqual({
          ok: false,
          error: { code: "unknown", message: "Boom" },
        });
      });
    });

    describe("### web", () => {
      beforeEach(() => {
        jest.replaceProperty(Platform, "OS", "web");
      });

      // The page navigates away, so no session can come back through the
      // promise — `detectSessionInUrl` picks it up on the next load instead.
      it("hands off to the redirect without opening a browser", async () => {
        auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null } as never);

        expect(await signInWithProvider("google")).toMatchObject({
          ok: false,
          error: { code: "redirecting" },
        });
        expect(auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: "google",
          options: { redirectTo: REDIRECT_URL },
        });
        expect(openAuthSession).not.toHaveBeenCalled();
      });

      it("reports a redirect that never started, rather than claiming to be redirecting", async () => {
        auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: OFFLINE } as never);

        expect(await signInWithProvider("google")).toMatchObject({
          ok: false,
          error: { code: "network" },
        });
      });
    });
  });

  describe("## signOut", () => {
    it("succeeds with no payload, as there is nothing left to hand back", async () => {
      auth.signOut.mockResolvedValue({ error: null } as never);

      expect(await signOut()).toEqual({ ok: true, data: null });
    });

    it("reports an offline attempt as network, matching sign-in", async () => {
      auth.signOut.mockResolvedValue({ error: OFFLINE } as never);

      expect(await signOut()).toMatchObject({ ok: false, error: { code: "network" } });
    });

    it("surfaces a failed sign-out instead of throwing mid-teardown", async () => {
      auth.signOut.mockResolvedValue({ error: apiError("unexpected_failure", "Boom") } as never);

      expect(await signOut()).toEqual({ ok: false, error: { code: "unknown", message: "Boom" } });
    });

    it("marks the sign-out as user-initiated, so the listener does not cry expiry", async () => {
      auth.signOut.mockResolvedValue({ error: null } as never);

      await signOut();

      expect(consumeUserInitiatedSignOut()).toBe(true);
    });

    it("leaves no mark when the sign-out fails, so a later expiry is still announced", async () => {
      auth.signOut.mockResolvedValue({ error: OFFLINE } as never);

      await signOut();

      expect(consumeUserInitiatedSignOut()).toBe(false);
    });

    it("leaves no mark when the client throws, for the same reason", async () => {
      auth.signOut.mockRejectedValue(new Error("Boom"));

      await signOut();

      expect(consumeUserInitiatedSignOut()).toBe(false);
    });
  });

  describe("## consumeUserInitiatedSignOut", () => {
    it("reports the mark once, so the next involuntary sign-out is not swallowed", async () => {
      auth.signOut.mockResolvedValue({ error: null } as never);
      await signOut();

      expect(consumeUserInitiatedSignOut()).toBe(true);
      expect(consumeUserInitiatedSignOut()).toBe(false);
    });
  });
});
