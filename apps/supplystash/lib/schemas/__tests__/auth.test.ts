import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_SPECIAL_CHARACTERS,
  signInSchema,
  signUpSchema,
} from "@/lib/schemas/auth";

// Long enough, and carrying one of every required class.
const VALID_PASSWORD = "Correct1Horse!";

// Every message produced for `password`, so a case can assert what a user would
// actually see rather than just that the parse failed.
const passwordErrors = (password: string) => {
  const result = signUpSchema.safeParse({ email: "stash@example.com", password });

  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path[0] === "password")
        .map((issue) => issue.message);
};

describe("# auth schemas", () => {
  describe("## signUpSchema", () => {
    it("accepts a password meeting every rule", () => {
      expect(passwordErrors(VALID_PASSWORD)).toEqual([]);
    });

    it("rejects a password shorter than the configured minimum", () => {
      expect(passwordErrors("Ab1!efgh")).toContain(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
    });

    it("requires an uppercase letter", () => {
      expect(passwordErrors("correct1horse!")).toContain(
        "Password must include an uppercase letter.",
      );
    });

    it("requires a lowercase letter", () => {
      expect(passwordErrors("CORRECT1HORSE!")).toContain(
        "Password must include a lowercase letter.",
      );
    });

    it("requires a number", () => {
      expect(passwordErrors("CorrectHorse!!")).toContain("Password must include a number.");
    });

    it("requires a special character", () => {
      expect(passwordErrors("Correct1Horsey")).toContain(
        "Password must include a special character.",
      );
    });

    // Rules are reported together: a user fixing one thing at a time because the
    // form only ever named one problem is the failure this guards against.
    it("reports every unmet rule at once", () => {
      expect(passwordErrors("short")).toEqual([
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
        "Password must include an uppercase letter.",
        "Password must include a number.",
        "Password must include a special character.",
      ]);
    });

    // The special-character set is interpolated into a regex character class, where
    // `] ^ - \` change the meaning of the class. Walking the whole set proves the
    // escaping instead of assuming it.
    it.each([...PASSWORD_SPECIAL_CHARACTERS])(
      "accepts %j as the special character",
      (character) => {
        expect(passwordErrors(`Correct1Horsey${character}`)).toEqual([]);
      },
    );

    it("rejects a character outside the allowed special set", () => {
      expect(passwordErrors("Correct1Horsey€")).toContain(
        "Password must include a special character.",
      );
    });

    it("rejects a malformed email", () => {
      const result = signUpSchema.safeParse({ email: "stash@", password: VALID_PASSWORD });

      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
        "Enter a valid email address.",
      );
    });
  });

  describe("## signInSchema", () => {
    // The sign-up policy must not apply here — an account created under an older,
    // looser policy still has to be able to sign in.
    it("accepts any non-empty password", () => {
      expect(signInSchema.safeParse({ email: "stash@example.com", password: "old" }).success).toBe(
        true,
      );
    });

    it("rejects an empty password", () => {
      const result = signInSchema.safeParse({ email: "stash@example.com", password: "" });

      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual([
        "Enter your password.",
      ]);
    });

    it("rejects a malformed email", () => {
      const result = signInSchema.safeParse({ email: "not-an-email", password: "hunter2" });

      expect(result.success).toBe(false);
    });
  });
});
