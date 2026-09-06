# Forms

Every form uses [TanStack Form](https://tanstack.com/form) with a zod schema. TanStack Query is
already in the repo, so this keeps one family of tools. Zod v4 satisfies Standard Schema, thus a
schema goes straight into `validators`. No resolver package is necessary.

## The pattern

```tsx
const form = useForm({
  defaultValues: { email: "", password: "" },
  validationLogic: revalidateLogic(),
  validators: { onDynamic: signInSchema },
  onSubmit: async ({ value }) => {
    /* ... */
  },
});
```

- **Schemas live in `apps/supplystash/lib/schemas/`**, one file for each domain
  (`apps/supplystash/lib/schemas/auth.ts`). The schema holds the messages that the user reads, thus
  the screen contains no message text.
- **Validate with `revalidateLogic()` and a single `onDynamic` validator.** The schema then runs
  when the user presses the submit button, and on each keystroke afterwards. The user thus reads no
  message before finishing the form, and a correction clears the message at once.

  Do not use `onBlur` at form level. A form-level validator checks the whole schema whenever any one
  field blurs, thus a jump from email to password marks the empty password field. A later keystroke
  does not clear that message, because a change event refreshes only the change slot. `canSubmit`
  stays `false`, and `handleSubmit` then returns without a word on the first press — the button
  appears dead until the user blurs the field.

- **Write one check for each rule.** Zod reports all failed checks. A password that has no digit and
  no symbol thus shows two messages, not one general message.
- **Show field errors with `<FormFieldErrors errors={field.state.meta.errors} />`**
  (`apps/supplystash/components/form-field-errors.tsx`). Standard Schema supplies issue objects, not
  strings. The component extracts the messages.
- **Put the label on the input with `aria-label`.** The `htmlFor` property of `Label` makes an
  association only on the web. Native platforms need the label on the input.

## Errors from the server

Field errors and server errors are different. Zod errors show below the related field. Errors from
Supabase (`AuthFailure` from `apps/supplystash/lib/auth.ts`) show at form level, because a rejected
credential pair does not belong to one field.

## The password policy

`apps/supplystash/lib/schemas/auth.ts` holds the policy and mirrors `supabase/config.toml` →
`[auth]`. Change the two files together. Sign-in makes a check only for a value that is not empty: a
stricter check would prevent access for an account that an earlier policy created.

## Tests

Use `@testing-library/react-native`. Mock `@/lib/auth` and make an assertion on the call, because a
successful attempt shows nothing — the session provider starts a redirect.
