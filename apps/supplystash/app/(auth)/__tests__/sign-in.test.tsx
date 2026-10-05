import { faker } from "@faker-js/faker";
import { render, screen, userEvent } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import SignInScreen from "@/app/(auth)/sign-in";
import { signInWithEmail } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({ signInWithEmail: jest.fn() }));

// Spread the real module: the screen renders a `Link`, which needs the actual
// navigation context. Only the two params entry points are stubbed.
jest.mock("expo-router", () => ({
  ...(jest.requireActual("expo-router") as object),
  router: { setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

const mockSignInWithEmail = jest.mocked(signInWithEmail);
const mockParams = jest.mocked(useLocalSearchParams);

// Success never renders anything here — the session provider redirects — so the
// happy path asserts on the call, not on the screen.
const succeeds = () =>
  mockSignInWithEmail.mockResolvedValue({
    ok: true,
    // The screen only branches on `ok`, so the session payload is irrelevant.
    data: {} as never,
  });

const fillAndSubmit = async (email: string, password: string) => {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.press(screen.getByText("Continue"));
};

describe("# SignInScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({});
  });

  // app/auth-callback.tsx bounces a failed OAuth round trip back here with the
  // reason as a param.
  describe("## bounced OAuth error", () => {
    const AUTH_ERROR = "User said no";

    it("renders a reason that was already present when the screen mounted", () => {
      mockParams.mockReturnValue({ authError: AUTH_ERROR });

      render(<SignInScreen />);

      expect(screen.getByText(AUTH_ERROR)).toBeOnTheScreen();
    });

    // The case a `useState` initializer cannot cover: the screen is already
    // mounted when the bounce lands, so only an effect ever sees the param.
    it("renders a reason that arrives while the screen is already mounted", () => {
      const { rerender } = render(<SignInScreen />);
      expect(screen.queryByText(AUTH_ERROR)).not.toBeOnTheScreen();

      mockParams.mockReturnValue({ authError: AUTH_ERROR });
      rerender(<SignInScreen />);

      expect(screen.getByText(AUTH_ERROR)).toBeOnTheScreen();
    });

    // On web the param sits in the address bar, so without this the same stale
    // error re-displays on every refresh.
    it("clears the param once the reason has been shown", () => {
      mockParams.mockReturnValue({ authError: AUTH_ERROR });

      render(<SignInScreen />);

      expect(router.setParams).toHaveBeenCalledWith({ authError: undefined });
    });
  });

  describe("## validation", () => {
    it("reports both empty fields and never reaches the network", async () => {
      const user = userEvent.setup();
      render(<SignInScreen />);

      await user.press(screen.getByText("Continue"));

      expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
      expect(screen.getByText("Enter your password.")).toBeOnTheScreen();
      expect(mockSignInWithEmail).not.toHaveBeenCalled();
    });

    it("rejects a malformed email before submitting", async () => {
      render(<SignInScreen />);

      await fillAndSubmit("stash@", "hunter2");

      expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
      expect(mockSignInWithEmail).not.toHaveBeenCalled();
    });

    // Sign-in must not apply the sign-up password policy: an account created
    // under an older policy still has to get in.
    it("submits a short password that the sign-up policy would reject", async () => {
      succeeds();
      render(<SignInScreen />);

      await fillAndSubmit("stash@example.com", "old");

      expect(mockSignInWithEmail).toHaveBeenCalledWith("stash@example.com", "old");
    });

    // Regression (STASH-20): the form used to validate on blur, which meant moving
    // from email to password marked the still-empty password field, and typing did
    // not clear that message. `canSubmit` stayed false and `handleSubmit` returned
    // without a word, so Continue looked dead until the user tapped out of the
    // field. `skipBlur` keeps the caret in the password input, as a real press does.
    it("submits on the first press while the password field still holds focus", async () => {
      const user = userEvent.setup();
      succeeds();
      render(<SignInScreen />);

      await user.type(screen.getByLabelText("Email"), "stash@example.com");
      await user.type(screen.getByLabelText("Password"), "hunter2", { skipBlur: true });
      await user.press(screen.getByText("Continue"));

      expect(mockSignInWithEmail).toHaveBeenCalledWith("stash@example.com", "hunter2");
    });
  });

  describe("## submission", () => {
    it("calls signInWithEmail with the typed values", async () => {
      succeeds();
      const email = faker.internet.email();
      const password = faker.internet.password({ length: 16, prefix: "Aa1!" });
      render(<SignInScreen />);

      await fillAndSubmit(email, password);

      expect(mockSignInWithEmail).toHaveBeenCalledWith(email, password);
    });

    it("renders a Supabase failure at form level", async () => {
      mockSignInWithEmail.mockResolvedValue({
        ok: false,
        error: { code: "invalid_credentials", message: "Invalid login credentials" },
      });
      render(<SignInScreen />);

      await fillAndSubmit("stash@example.com", "wrong-password");

      expect(await screen.findByText("Invalid login credentials")).toBeOnTheScreen();
    });
  });
});
