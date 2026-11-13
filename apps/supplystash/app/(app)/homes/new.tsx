import { revalidateLogic, useForm } from "@tanstack/react-form";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AppSafeScrollScreen } from "@/components/app-safe-screen";
import { BlockedControl } from "@/components/blocked-control";
import { FormFieldErrors } from "@/components/form-field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { isNetworkFailure, postgrestErrorCode } from "@/lib/postgrest-error";
import { createHomeSchema, HOME_NAME_TOO_LONG_MESSAGE } from "@/lib/schemas/home";
import { useCreateHome } from "@/state/homes";

// SQLSTATE check_violation: the `homes_name_length` constraint refused the
// name. The schema enforces the same limit first, so this only shows if the
// two have drifted apart.
const CHECK_VIOLATION = "23514";

// Chosen by error code, never by the server's message text, which is written
// for developers and can change.
const createHomeErrorMessage = (error: unknown) => {
  if (isNetworkFailure(error)) {
    return "Can't reach the server. Try again.";
  }

  return postgrestErrorCode(error) === CHECK_VIOLATION
    ? HOME_NAME_TOO_LONG_MESSAGE
    : "Couldn't create the home. Try again.";
};

// Draft UI: a name and a button. The "Invite Members" section from the design
// lands in STASH-63, after the invite flow exists.
export default function NewHomeScreen() {
  const { mutateAsync: createHome } = useCreateHome();
  // A server failure is form-level: it is not about the name the user typed.
  // It stays until the next submit, and the form can be submitted again.
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "" },
    // Validate on Create, then on every keystroke after. See docs/forms.md.
    validationLogic: revalidateLogic(),
    validators: { onDynamic: createHomeSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);

      try {
        // Parsed again for its output: the validator only checks, so `value`
        // still holds the name as typed, spaces included.
        const homeId = await createHome(createHomeSchema.parse(value).name);
        // Replace, so Back from the new home goes to the Home tab, not here.
        router.replace({ pathname: "/homes/[homeId]", params: { homeId } });
      } catch (error) {
        setFormError(createHomeErrorMessage(error));
      }
    },
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "New Home" }} />
      <AppSafeScrollScreen
        edges={["bottom", "left", "right"]}
        contentContainerClassName="gap-6 p-4"
      >
        <form.Field name="name">
          {(field) => (
            <View className="gap-1.5">
              <Label htmlFor="name">Home name</Label>
              <Input
                id="name"
                // `htmlFor` on Label only associates on web; native needs the
                // label spelled out on the input itself.
                aria-label="Home name"
                placeholder="Lake House"
                autoCapitalize="words"
                autoFocus
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                onSubmitEditing={() => void form.handleSubmit()}
                returnKeyType="done"
              />
              <FormFieldErrors errors={field.state.meta.errors} />
            </View>
          )}
        </form.Field>

        {formError ? <Text className="text-sm text-destructive">{formError}</Text> : null}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <BlockedControl action="membership" label="Create home">
              {(blocked) => (
                <Button
                  className="w-full"
                  disabled={blocked || isSubmitting}
                  onPress={() => void form.handleSubmit()}
                >
                  <Text>{isSubmitting ? "Creating…" : "Create home"}</Text>
                </Button>
              )}
            </BlockedControl>
          )}
        </form.Subscribe>
      </AppSafeScrollScreen>
    </>
  );
}
