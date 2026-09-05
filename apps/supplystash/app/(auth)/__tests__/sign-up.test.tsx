import { faker } from "@faker-js/faker";
import { render, screen, userEvent } from "@testing-library/react-native";

import SignUpScreen from "@/app/(auth)/sign-up";
import { signUpWithEmail } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH } from "@/lib/schemas/auth";

jest.mock("@/lib/auth", () => ({ signUpWithEmail: jest.fn() }));

const mockSignUpWithEmail = jest.mocked(signUpWithEmail);

// Success never renders anything here — the session provider redirects — so the
// happy path asserts on the call, not on the screen.
const succeeds = () =>
  mockSignUpWithEmail.mockResolvedValue({
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

describe("# SignUpScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("## validation", () => {
    it("reports both empty fields and never reaches the network", async () => {
      const user = userEvent.setup();
      render(<SignUpScreen />);

      await user.press(screen.getByText("Continue"));

      expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
      expect(
        screen.getByText(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
      ).toBeOnTheScreen();
      expect(mockSignUpWithEmail).not.toHaveBeenCalled();
    });

    // A user who fixes one rule per attempt gives up. Every unmet rule shows at
    // once, which is why the schema uses separate checks.
    it("reports every unmet password rule together", async () => {
      render(<SignUpScreen />);

      await fillAndSubmit("stash@example.com", "short");

      expect(
        screen.getByText(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
      ).toBeOnTheScreen();
      expect(screen.getByText("Password must include an uppercase letter.")).toBeOnTheScreen();
      expect(screen.getByText("Password must include a number.")).toBeOnTheScreen();
      expect(screen.getByText("Password must include a special character.")).toBeOnTheScreen();
      expect(mockSignUpWithEmail).not.toHaveBeenCalled();
    });

    it("states the password policy before an attempt is made", () => {
      render(<SignUpScreen />);

      expect(
        screen.getByText(
          `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter, a number, and a special character.`,
        ),
      ).toBeOnTheScreen();
    });

    it("rejects a malformed email before submitting", async () => {
      render(<SignUpScreen />);

      await fillAndSubmit("stash@", "Correct1Horse!");

      expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
      expect(mockSignUpWithEmail).not.toHaveBeenCalled();
    });
  });

  describe("## submission", () => {
    it("calls signUpWithEmail with the typed values", async () => {
      succeeds();
      const email = faker.internet.email();
      const password = faker.internet.password({ length: 16, prefix: "Aa1!" });
      render(<SignUpScreen />);

      await fillAndSubmit(email, password);

      expect(mockSignUpWithEmail).toHaveBeenCalledWith(email, password);
    });

    it("renders a Supabase failure at form level", async () => {
      mockSignUpWithEmail.mockResolvedValue({
        ok: false,
        error: { code: "email_taken", message: "User already registered" },
      });
      render(<SignUpScreen />);

      await fillAndSubmit("stash@example.com", "Correct1Horse!");

      expect(await screen.findByText("User already registered")).toBeOnTheScreen();
    });
  });
});
