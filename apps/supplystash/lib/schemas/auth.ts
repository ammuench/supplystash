import { z } from "zod";

// Mirrors `supabase/config.toml` → `[auth] minimum_password_length`. GoTrue is the
// real gate; validating here first means the user sees the rule before a round trip.
export const PASSWORD_MIN_LENGTH = 12;

// `[auth] password_requirements` only offers preset character classes, and its
// `lower_upper_letters_digits_symbols` setting has no configurable symbol list — so
// the exact allowed set lives here and is a client-side rule on top of the server's.
export const PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*()-_+=[]{}:;'\"<>,.?`|\\/";

// `[]`, `^`, `-` and `\` all mean something inside a character class, so every
// character is escaped rather than trusting the set to stay free of them.
const escapeForCharacterClass = (characters: string) =>
  characters.replaceAll(/[\\\]^-]/g, (character) => `\\${character}`);

const SPECIAL_CHARACTER_PATTERN = new RegExp(
  `[${escapeForCharacterClass(PASSWORD_SPECIAL_CHARACTERS)}]`,
);

const emailSchema = z.email("Enter a valid email address.");

// One check per rule, not a single combined regex: zod reports every failed check,
// so a password missing both a digit and a symbol says so instead of naming one.
const signUpPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/\d/, "Password must include a number.")
  .regex(SPECIAL_CHARACTER_PATTERN, "Password must include a special character.");

// Sign-in deliberately checks only for presence. Applying the sign-up policy here
// would lock out any account created before the policy — the server decides whether
// an existing credential is still good.
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: signUpPasswordSchema,
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
