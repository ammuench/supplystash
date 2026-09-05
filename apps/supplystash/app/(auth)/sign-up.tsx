import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useRef, useState } from "react";
import { type TextInput, View } from "react-native";

import { AppSafeScrollScreen } from "@/components/app-safe-screen";
import { FormFieldErrors } from "@/components/form-field-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { signUpWithEmail } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH, signUpSchema } from "@/lib/schemas/auth";

// Five rules is too many to discover one rejection at a time, so the policy is
// stated up front rather than only after a failed attempt.
const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter, a number, and a special character.`;

// Draft UI: the react-native-reusables sign-up block, minus its social buttons
// (no OAuth exists yet). Real designs are pending — the logic underneath is the
// point.
export default function SignUpScreen() {
  const passwordInputRef = useRef<TextInput>(null);
  // Supabase failures are form-level: "email already registered" belongs to the
  // attempt, not to a single field's syntax.
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onBlur: signUpSchema, onSubmit: signUpSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);

      const result = await signUpWithEmail(value.email, value.password);
      if (!result.ok) {
        setFormError(result.error.message);
      }

      // Nothing to do on success: `onAuthStateChange` updates the session and the
      // guard in `(auth)/_layout.tsx` redirects, unmounting this screen.
    },
  });

  return (
    <AppSafeScrollScreen contentContainerClassName="flex-grow justify-center gap-6 p-4">
      <Card className="border-border/0 shadow-none sm:border-border sm:shadow-sm sm:shadow-black/5">
        <CardHeader>
          <CardTitle className="text-center text-xl sm:text-left">Create your account</CardTitle>
          <CardDescription className="text-center sm:text-left">
            Welcome! Please fill in the details to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          <View className="gap-6">
            <form.Field name="email">
              {(field) => (
                <View className="gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    // `htmlFor` on Label only associates on web; native needs the
                    // label spelled out on the input itself.
                    aria-label="Email"
                    placeholder="m@example.com"
                    keyboardType="email-address"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    returnKeyType="next"
                    submitBehavior="submit"
                  />
                  <FormFieldErrors errors={field.state.meta.errors} />
                </View>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <View className="gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    ref={passwordInputRef}
                    id="password"
                    aria-label="Password"
                    secureTextEntry
                    autoComplete="new-password"
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    onSubmitEditing={() => void form.handleSubmit()}
                    returnKeyType="send"
                  />
                  <Text className="text-sm text-muted-foreground">{PASSWORD_HINT}</Text>
                  <FormFieldErrors errors={field.state.meta.errors} />
                </View>
              )}
            </form.Field>

            {formError ? <Text className="text-sm text-destructive">{formError}</Text> : null}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  className="w-full"
                  disabled={isSubmitting}
                  onPress={() => void form.handleSubmit()}
                >
                  <Text>{isSubmitting ? "Creating account…" : "Continue"}</Text>
                </Button>
              )}
            </form.Subscribe>
          </View>

          <Text className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/sign-in" className="underline underline-offset-4">
              Sign in
            </Link>
          </Text>
        </CardContent>
      </Card>
    </AppSafeScrollScreen>
  );
}
