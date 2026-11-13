# SupplyStash: notes for coding agents

Short rules that keep the code consistent. Keep this file current: when a new convention is
agreed, add one line here in the same change. Longer explanations belong in [`docs/`](./docs/README.md),
and this file links to them.

## Layout

- Monorepo. The app is `apps/supplystash/` (Expo, expo-router, Uniwind, TanStack Query, Supabase).
- Database: `supabase/migrations/` and pgTAP tests in `supabase/tests/`.
- Import with the `@/` alias, which points at `apps/supplystash/`.

## Commands

Run from the repo root.

| Task                           | Command                          |
| ------------------------------ | -------------------------------- |
| Tests                          | `pnpm test`                      |
| Types                          | `pnpm check-types`               |
| Lint, format check             | `pnpm lint`, `pnpm format:check` |
| Local database (needs Docker)  | `pnpm db:start`, `pnpm db:reset` |
| pgTAP tests, migration lint    | `pnpm db:test`, `pnpm db:lint`   |
| Regenerate `database.types.ts` | `pnpm db:types`                  |

All of them must pass before a change is called done.

## Read first

| Working on                      | Read                                           |
| ------------------------------- | ---------------------------------------------- |
| A query or mutation             | [docs/query-keys.md](./docs/query-keys.md)     |
| Anything cached or offline      | [docs/persistence.md](./docs/persistence.md)   |
| A form                          | [docs/forms.md](./docs/forms.md)               |
| A control that needs the server | [docs/connectivity.md](./docs/connectivity.md) |

## Components

- Write `export const Foo = () => {}`. No trailing `export { }` block. Route files under `app/`
  keep `export default function`.
- `components/ui/` holds the react-native-reusables kit. Do not restyle kit files for one screen.
- **Tappable card, row or tile:** use `PressableSurface` (`components/ui/pressable-surface.tsx`),
  never a bare `Pressable`. It carries the standard pressed and hover feedback. Buttons use `Button`.
- **A control whose action needs the server:** wrap it in `BlockedControl`
  (`components/blocked-control.tsx`) with the matching action from `lib/blocked-reason.ts`.
- **Screens:** use `AppSafeScreen` or `AppSafeScrollScreen` (`components/app-safe-screen.tsx`). Under
  a visible Stack header pass `edges={["bottom", "left", "right"]}`.
- **Colors:** theme tokens only (`bg-muted`, `text-muted-foreground`, `bg-accent`, …), never raw
  values. For a lucide icon, pass the color as a prop from `useCSSVariable`; a color class on the
  icon does not apply on web.
- **Toasts:** the helpers in `lib/toast.tsx`.
- Comments say why, not what. Mark temporary code with the ticket that removes it.

## Data

- Query keys come from `state/query-keys.ts`. Never inline a key array.
- Hooks live in `state/`. Call supabase-js with `.throwOnError()` so the `PostgrestError` reaches
  the caller, and branch on its code with `lib/postgrest-error.ts`, never on message text.
- Home and membership writes are online-only: go through an RPC, set `networkMode: "always"`, and
  show the failure. Only writes meant to queue offline follow "Writing an offline-capable mutation"
  in docs/persistence.md.
- Never show a server's message text to the user.

## Forms

- TanStack Form with a zod schema from `lib/schemas/`. The schema holds the user-facing messages.
- A limit enforced in the database is mirrored by a constant in the schema file, with a comment
  naming the migration. Change the two together.

## Database

- All SQL goes in a migration file. Nothing is changed through the Supabase dashboard.
- Tables are written through RPCs; RLS allows members to read.
- Add a constraint as `not valid`, then `validate` it in a second transaction (squawk enforces this).
- Every migration that changes behavior gets pgTAP tests.
- Never run a migration or SQL against a remote database. The repo owner does that.

## Tests

- `describe` names are markdown headers by depth: `describe("# Thing")`, `describe("## case")`.
- Jest and `@testing-library/react-native`. Screen tests follow
  `app/(auth)/__tests__/sign-in.test.tsx`; hook tests follow `state/__tests__/homes.test.tsx`.
- A test `QueryClient` sets `gcTime: Infinity` for queries and mutations, or a 5-minute timer keeps
  Jest from exiting.
- Mock `lucide-react-native` in any test that renders an icon; transforming its barrel is slow.
- A warning in test output (for example "not wrapped in act") is a failure to fix, not noise.

## Git

- Do not commit, push or open a pull request unless asked.
- Commit titles are Gitmoji, title only: `✨ (STASH-57): Add create home schema`.
- Branches are `feature/stash-<number>`.
