import { z } from "zod";

// Mirrors `supabase/config.toml` → `[auth] minimum_password_length`. GoTrue is the
// real gate; validating here first means the user sees the rule before a round trip.
export const PASSWORD_MIN_LENGTH = 12;

// Mirrors the symbol group the Supabase CLI sends GoTrue for `[auth]
// password_requirements = "lower_upper_letters_digits_symbols"`. That preset has no
// configurable list and is ASCII-only, so a broader client rule would accept "€"
// only for the server to reject it. Keep the two sets identical.
export const PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*()-_+=[]{}:;'\"<>,.?`|\\/~";

// Points at the set rather than repeating it: sign-up renders the set beneath its
// password hint, always visible. "A special character" alone told a user whose only
// symbol is "€" to add something they could see they already had.
export const PASSWORD_SYMBOL_MESSAGE =
  "Password must include one of the special symbols listed above.";

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
  .regex(SPECIAL_CHARACTER_PATTERN, PASSWORD_SYMBOL_MESSAGE);

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
