# SupplyStash app

The Expo client. Setup, environment variables, and database commands live in the
[root README](../../README.md); this page covers the app package itself.

## Running it

```bash
pnpm dev          # Metro for a dev-client build (clears the cache)
pnpm start        # same, without the cache clear
pnpm web          # browser
pnpm ios          # native run, requires a local prebuild
pnpm android
```

A web crash with runaway `createOrderedCSSStyleSheet` recursion is a stale Metro
cache, not a code bug — `pnpm dev` already passes `-c`.

## Checks

```bash
pnpm test         # jest (jest-expo preset)
pnpm check-types  # tsc --noEmit
```

Formatting and linting are oxfmt + oxlint, wired into the pre-commit hook at the
repo root — there is no prettier or eslint here.

## Builds

EAS profiles are defined in `eas.json`; the `build:*` and `submit:*` scripts set
`EAS_BUILD_PROFILE` and hand off to `eas`. `development` builds load JS from
Metro, so they read your local `.env`; `preview` and `production` bake values
from `eas.json`.

## Layout

| Path          | Contents                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| `app/`        | expo-router routes and layouts                                           |
| `components/` | shared components; `components/ui` is the reusables primitive set        |
| `lib/`        | Supabase client, env parsing, analytics, theme, helpers                  |
| `state/`      | TanStack Query keys — see [docs/query-keys.md](../../docs/query-keys.md) |
| `utils/`      | test helpers                                                             |
| `__tests__/`  | package-level tests (EAS config rules)                                   |

Styling is uniwind/NativeWind. `global.css` is the source of truth; the tracked
`oxfmt-tailwind.css` mirrors it so class sorting stays stable, since uniwind
rewrites its copy inside `node_modules`.
