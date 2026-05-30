# 65Y-ci-action-versions-in-config. Centralise CI action versions in `config/module.f.ts`

**Priority:** P4
**Status:** open

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

## Proposal

Add an `actions` (or `ghActions`) record to `fs/ci/config/module.f.ts`:

```ts
export const actions = {
    'actions/checkout':                          'v5',
    'actions/setup-node':                        'v6',
    'actions/cache':                             'v4',
    'denoland/setup-deno':                       'v2',
    'oven-sh/setup-bun':                         'v2',
    'bytecodealliance/actions/wasmtime/setup':   'v1',
    'wasmerio/setup-wasmer':                     'v3.1',
} as const
```

The key is the action name; call sites compose the full reference as
`` `${name}@${actions[name]}` ``. Replace every inline string with such a
reference.
