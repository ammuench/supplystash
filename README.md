# Supply Stash

Expo + Supabase monorepo. See [`supply-stash-architecture.md`](./supply-stash-architecture.md)
for the design; this file covers setup and environment variables.

## Quick start

```bash
pnpm install

cp apps/supplystash/.env.example apps/supplystash/.env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from
# the hosted dev project: https://supabase.com/dashboard/project/_/settings/api

pnpm dev:mobile        # or: pnpm dev:web
```

The app points at the **remote** Supabase project by default — nothing to run
locally, and no context to swap when moving between the app and the dashboard.

Run the local stack only when you want a throwaway database (testing a
destructive migration, or working offline):

```bash
pnpm db:start          # start the local Supabase stack
pnpm db:status         # prints the API URL and publishable key
```

then point `EXPO_PUBLIC_SUPABASE_URL` at `http://127.0.0.1:54321` and paste the
publishable key it prints. Migrations live in `supabase/migrations` either way.

## Environment variables

> **There is exactly one env file you create locally: `apps/supplystash/.env`.**
> Do **not** create a root `.env` — nothing reads it, by design.

Env files do not cascade in this workspace. Expo resolves them against the
Expo project directory (`apps/supplystash`) with no upward traversal, and pnpm
never auto-loads a `.env` at all. A root `.env` would be read by nothing.

Copy the template to `.env`, never `.env.local` — the header of
[`apps/supplystash/.env.example`](./apps/supplystash/.env.example) explains the
precedence rules and why one file is the right call here. That file is also
where the `EXPO_PUBLIC_` rules and the eas.json mirroring step are documented,
so read it before adding a new variable.

### Where each variable lives

| Variable                               | Local dev                    | EAS build                            | CI                                 |
| -------------------------------------- | ---------------------------- | ------------------------------------ | ---------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | `apps/supplystash/.env`      | `eas.json` — `preview`, `production` | —                                  |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/supplystash/.env`      | `eas.json` — `preview`, `production` | —                                  |
| `EXPO_PUBLIC_POSTHOG_API_KEY`          | `apps/supplystash/.env`      | `eas.json` — `preview`, `production` | —                                  |
| `EXPO_PUBLIC_POSTHOG_HOST`             | `apps/supplystash/.env`      | `eas.json` — `preview`, `production` | —                                  |
| `POSTHOG_CLI_ENV_ID`                   | **never** — build only       | `eas.json` — `preview`, `production` | —                                  |
| `POSTHOG_CLI_HOST`                     | **never** — build only       | `eas.json` — `preview`, `production` | —                                  |
| `POSTHOG_CLI_TOKEN`                    | **never** — build only       | EAS secret                           | —                                  |
| `EAS_BUILD_PROFILE`                    | set by the `build:*` scripts | `eas.json` — all profiles            | —                                  |
| `SUPABASE_DB_URL_PROD`                 | **never** — CI only          | —                                    | `SUPABASE_DB_URL_PROD` repo secret |

The `POSTHOG_CLI_*` variables are build-time only and carry no `EXPO_PUBLIC_`
prefix, so they never reach the client bundle. They drive source-map upload
during native builds; `app.config.ts` injects that build phase only when
`POSTHOG_CLI_ENV_ID` is non-empty, so builds succeed (without symbolication)
while PostHog is unprovisioned. `POSTHOG_CLI_TOKEN` is a credential and must
stay an EAS secret, never committed to `eas.json`.

PostHog is on the **EU** region (`eu.i.posthog.com`) so event data stays in the
EU. The project key is region-specific — a US host silently rejects events.

Adding a new `EXPO_PUBLIC_*` variable is a two-place edit: the local `.env`
(plus the checked-in `.env.example`) and the `preview` + `production` env
blocks in `eas.json`. The `development` and `development-simulator` profiles
are `developmentClient` builds that load JS from Metro at runtime, so they read
your local `.env` and need nothing baked in.

Every `.env*` is gitignored at any depth; only the two `.env.example` files are
tracked.

## Database

Migrations live in `supabase/migrations`. Local work:

```bash
pnpm db:new-migration <name>   # scaffold a migration
pnpm db:reset                  # re-apply everything from scratch
pnpm db:test                   # pgTAP tests
pnpm db:types                  # regenerate lib/database.types.ts
```

**Prod migrations are CI-only.** `pnpm db:migrate:prod` reads
`$SUPABASE_DB_URL_PROD` from the shell, and nothing populates it locally — so
run from a laptop it resolves to an empty connection string and fails. That is
intentional, not a bug. Production migrations run through the **Deploy DB
migrations (prod)** GitHub workflow (`workflow_dispatch`, with a `dry-run`
input), which injects the repository secret.
