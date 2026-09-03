import type { Session, User } from "@supabase/supabase-js";

import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

import { signInWithEmail, signOut, signUpWithEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// `lib/supabase` is mocked rather than the network: these wrappers own the
// mapping from supabase-js's shape to ours, and that is all this suite asserts.
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;

const USER = { id: "00000000-0000-0000-0000-000000000000" } as User;
const SESSION = { access_token: "header.payload.signature", user: USER } as Session;

// supabase-js reports a bad password as an AuthApiError carrying a `code`.
const apiError = (code: string, message: string) => new AuthApiError(message, 400, code);

beforeEach(() => {
  jest.clearAllMocks();
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

    it("turns a thrown fetch failure into a result, so offline does not reject", async () => {
      auth.signInWithPassword.mockRejectedValue(
        new AuthRetryableFetchError("Network request failed", 0),
      );

      const result = await signInWithEmail("a@example.com", "hunter2hunter2");

      expect(result).toEqual({
        ok: false,
        error: { code: "network", message: "Network request failed" },
      });
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

    it("fails closed when no session comes back, rather than reporting a signed-out success", async () => {
      auth.signUp.mockResolvedValue({ data: { session: null, user: USER }, error: null } as never);

      const result = await signUpWithEmail("new@example.com", "hunter2hunter2");

      expect(result).toMatchObject({ ok: false, error: { code: "unknown" } });
    });
  });

  describe("## signOut", () => {
    it("succeeds with no payload, as there is nothing left to hand back", async () => {
      auth.signOut.mockResolvedValue({ error: null } as never);

      expect(await signOut()).toEqual({ ok: true, data: null });
    });

    it("surfaces a failed sign-out instead of throwing mid-teardown", async () => {
      auth.signOut.mockResolvedValue({ error: apiError("unexpected_failure", "Boom") } as never);

      expect(await signOut()).toEqual({ ok: false, error: { code: "unknown", message: "Boom" } });
    });
  });
});
