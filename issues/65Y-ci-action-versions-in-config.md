# 65Y-ci-action-versions-in-config. Centralise CI action versions in `config/module.f.ts`

**Priority:** P4
**Status:** done

## Problem

Tool versions (Node, Bun, Deno, Rust, Playwright, …) are already centralised in
`fs/ci/config/module.f.ts`, but GitHub Action versions are hardcoded inline
across several modules:

| action | hardcoded in |
|--------|-------------|
| `actions/checkout@v5` | `fs/ci/common/module.f.ts` |
| `actions/setup-node@v6` | `fs/ci/node/module.f.ts` |
| `actions/cache@v4` | `fs/ci/playwright/module.f.ts` |
| `denoland/setup-deno@v2` | `fs/ci/deno/module.f.ts` |
| `oven-sh/setup-bun@v2` | `fs/ci/bun/module.f.ts` |
| `bytecodealliance/actions/wasmtime/setup@v1` | `fs/ci/rust/module.f.ts` |
| `wasmerio/setup-wasmer@v3.1` | `fs/ci/rust/module.f.ts` |

Bumping any action version requires hunting across multiple files instead of
changing one line in `config/module.f.ts`.

## Resolution

Added a `ghActions` record to `fs/ci/config/module.f.ts`. The design
diverges from the original draft (which stored bare versions keyed by
`owner/name`) and stores **full `owner/name@version` refs** instead, so
call sites drop them straight into a step's `uses` field with no string
composition:

```ts
export const ghActions = {
    checkout:  'actions/checkout@v5',
    setupNode: 'actions/setup-node@v6',
    cache:     'actions/cache@v4',
    setupDeno: 'denoland/setup-deno@v2',
    setupBun:  'oven-sh/setup-bun@v2',
    wasmtime:  'bytecodealliance/actions/wasmtime/setup@v1',
    wasmer:    'wasmerio/setup-wasmer@v3.1',
} as const
```

Why the full-ref shape was chosen over the original `name → version`
shape:

- **Call sites are trivial.** `uses: ghActions.checkout` reads cleanly;
  the alternative `uses: \`actions/checkout@${actions['actions/checkout']}\``
  forces every site to repeat the action name twice.
- **Matches the existing config style.** Sibling pins (`bun`, `deno`,
  `playwright`, `rust`, `wasmtime`, `wasmer`, `tsgo`) are bare strings
  pinned for use at the call site, not key/value pairs. `ghActions`
  inherits that shape.
- **`dtolnay/rust-toolchain` is intentionally excluded.** Its tag *is*
  the rust toolchain version (already pinned via `rust` in this file),
  not an action version, so it stays as `dtolnay/rust-toolchain@${rust}`
  in `fs/ci/common/module.f.ts`.

Each entry carries a marketplace URL comment so version bumps follow the
same review trail as `bun` / `deno` / `node` etc. Call sites updated in
`fs/ci/{common,node,playwright,deno,bun,rust}/module.f.ts`. Regenerating
`.github/workflows/ci.yml` via `npm run ci-update` produces no diff,
confirming the change is purely structural.
