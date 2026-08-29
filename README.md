# Supply Stash

Expo + Supabase monorepo. See [`supply-stash-architecture.md`](./supply-stash-architecture.md)
for the design; this file covers setup and environment variables.

## Quick start

```bash
pnpm install
pnpm db:start          # start the local Supabase stack
pnpm db:status         # prints the API URL and anon key

cp apps/supplystash/.env.example apps/supplystash/.env
# paste the anon key from db:status into EXPO_PUBLIC_SUPABASE_ANON_KEY

pnpm dev:mobile        # or: pnpm dev:web
```

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

| Variable                        | Local dev                    | EAS build                            | CI                                 |
| ------------------------------- | ---------------------------- | ------------------------------------ | ---------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | `apps/supplystash/.env`      | `eas.json` — `preview`, `production` | —                                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/supplystash/.env`      | `eas.json` — `preview`, `production` | —                                  |
| `EAS_BUILD_PROFILE`             | set by the `build:*` scripts | `eas.json` — all profiles            | —                                  |
| `SUPABASE_DB_URL_PROD`          | **never** — CI only          | —                                    | `SUPABASE_DB_URL_PROD` repo secret |

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
