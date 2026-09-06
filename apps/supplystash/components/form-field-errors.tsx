import { View } from "react-native";

import { Text } from "@/components/ui/text";

export type FormFieldErrorsProps = {
  /** `field.state.meta.errors` straight from a TanStack Form field. */
  errors: readonly unknown[];
};

// Standard Schema validators hand back issue objects, not strings, so a bare
// `errors.join()` renders "[object Object]". The dedupe is belt-and-braces: one
// `onDynamic` validator writes a single slot, but a form that adds a second
// validator would otherwise repeat a message the user has already read.
const toMessages = (errors: readonly unknown[]) => [
  ...new Set(
    errors.map((error) =>
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : String(error),
    ),
  ),
];

/**
 * Validation messages for one form field. Renders nothing when the field is valid.
 *
 * @component
 * @example
 * ```tsx
 * <form.Field name="email">
 *   {(field) => (
 *     <View className="gap-1.5">
 *       <Input value={field.state.value} onChangeText={field.handleChange} />
 *       <FormFieldErrors errors={field.state.meta.errors} />
 *     </View>
 *   )}
 * </form.Field>
 * ```
 */
export const FormFieldErrors = ({ errors }: FormFieldErrorsProps) => {
  const messages = toMessages(errors);

  if (messages.length === 0) {
    return null;
  }

  return (
    <View className="gap-1">
      {messages.map((message) => (
        <Text key={message} className="text-sm text-destructive">
          {message}
        </Text>
      ))}
    </View>
  );
};
