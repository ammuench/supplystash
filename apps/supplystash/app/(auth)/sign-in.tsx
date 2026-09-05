import { useForm } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { type TextInput, View } from "react-native";

import { AppSafeScrollScreen } from "@/components/app-safe-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { signInWithEmail } from "@/lib/auth";
import { signInSchema } from "@/lib/schemas/auth";

// Standard Schema validators hand back issue objects, not strings, so a bare
// `errors.join()` renders "[object Object]". The same schema runs on both blur
// and submit, so a field can hold two copies of one message — dedupe rather than
// telling the user the same thing twice.
const errorMessages = (errors: readonly unknown[]) => [
  ...new Set(
    errors.map((error) =>
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : String(error),
    ),
  ),
];

// Draft UI: the react-native-reusables sign-in block, minus its social buttons
// and forgot-password link (no OAuth and no reset flow exist yet). Real designs
// are pending — the logic underneath is the point.
export default function SignInScreen() {
  const passwordInputRef = useRef<TextInput>(null);
  // Supabase failures are form-level: a rejected credential pair does not belong
  // to either field on its own.
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onBlur: signInSchema, onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);

      const result = await signInWithEmail(value.email, value.password);
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
          <CardTitle className="text-center text-xl sm:text-left">Sign in to SupplyStash</CardTitle>
          <CardDescription className="text-center sm:text-left">
            Welcome back! Please sign in to continue.
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
                  {field.state.meta.isValid
                    ? null
                    : errorMessages(field.state.meta.errors).map((message) => (
                        <Text key={message} className="text-sm text-destructive">
                          {message}
                        </Text>
                      ))}
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
                    autoComplete="current-password"
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    onSubmitEditing={() => void form.handleSubmit()}
                    returnKeyType="send"
                  />
                  {field.state.meta.isValid
                    ? null
                    : errorMessages(field.state.meta.errors).map((message) => (
                        <Text key={message} className="text-sm text-destructive">
                          {message}
                        </Text>
                      ))}
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
                  <Text>{isSubmitting ? "Signing in…" : "Continue"}</Text>
                </Button>
              )}
            </form.Subscribe>
          </View>

          {/* The link waits on the route: expo-router types `href` from the files
              that exist, so pointing at /sign-up before it lands fails check-types. */}
          <Text className="text-center text-sm">Don&apos;t have an account? Sign up</Text>
        </CardContent>
      </Card>
    </AppSafeScrollScreen>
  );
}
