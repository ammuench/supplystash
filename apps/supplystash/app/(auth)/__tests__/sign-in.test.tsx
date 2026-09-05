import { faker } from "@faker-js/faker";
import { render, screen, userEvent } from "@testing-library/react-native";

import SignInScreen from "@/app/(auth)/sign-in";
import { signInWithEmail } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({ signInWithEmail: jest.fn() }));

const mockSignInWithEmail = jest.mocked(signInWithEmail);

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
