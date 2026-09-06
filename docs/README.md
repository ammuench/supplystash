# SupplyStash internal docs

Concise, load-bearing conventions the codebase and Linear tickets point at. Each page is meant
to stay short and current. When one of these conflicts with
[`supply-stash-architecture.md`](../supply-stash-architecture.md), **these pages win** — the
architecture doc is the original design narrative and will be retired in pieces as its decisions
land here.

| Page                               | Covers                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| [query-keys.md](./query-keys.md)   | TanStack Query key convention — `homeId` in every key, the factory, how to add a new key. |
| [persistence.md](./persistence.md) | The two persistence layers (auth session vs. query cache) and what backs each.            |
| [forms.md](./forms.md)             | TanStack Form + zod convention — where schemas live, how errors render.                   |

Setup and environment variables live in the [root README](../README.md).
