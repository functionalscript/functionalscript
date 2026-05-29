# 175. `fs/ci`: a `setupTool` factory for pinned-version install steps

**Priority:** P3
**Status:** open

Five CI modules construct a GitHub Actions "setup" step with the identical
shape `install({ uses: '<action>', with: { '<x>-version': <pinnedVersion> } })`,
differing only in the action string and the version key/value:

```ts
// ci/node/module.f.ts:12
const installNode = (version: string) =>
    ({ uses: 'actions/setup-node@v6', with: { 'node-version': version } })

// ci/deno/module.f.ts:11
install({ uses: 'denoland/setup-deno@v2', with: { 'deno-version': deno } })

// ci/bun/module.f.ts:22  (the non-Windows-ARM default)
{ uses: 'oven-sh/setup-bun@v2', with: { 'bun-version': bun } }

// ci/rust/module.f.ts:48
install({ uses: 'bytecodealliance/actions/wasmtime/setup@v1', with: { version: wasmtime } })
// ci/rust/module.f.ts:52
install({ uses: 'wasmerio/setup-wasmer@v3.1', with: { version: `v${wasmer}` } })
```

## Proposed abstraction

A small factory in `fs/ci/common/module.f.ts` that captures "a setup action
parameterized by one pinned version":

```ts
export const setupTool =
    (uses: string, versionKey: string) =>
    (version: string): Step =>
        ({ uses, with: { [versionKey]: version } })
```

- `installNode  = setupTool('actions/setup-node@v6', 'node-version')`
- `installDeno  = setupTool('denoland/setup-deno@v2', 'deno-version')`
- `bun`'s default branch = `setupTool('oven-sh/setup-bun@v2', 'bun-version')`
- wasmtime / wasmer = `setupTool('bytecodealliance/actions/wasmtime/setup@v1', 'version')`
  and `setupTool('wasmerio/setup-wasmer@v3.1', 'version')` (wasmer keeps its
  `v${...}` formatting at the call site).

## Why this qualifies

- Five real call sites today, all shipping.
- It is the textbook `AGENTS.md` case: identical shape, only data (action
  descriptor, version key/value) varies.
- It is **complementary to, not a duplicate of, [i170](./README.md)/[i171](./README.md)**.
  Those issues extract the *step sequence* `toolSteps(setup, cmds)` and
  deliberately take the install step as a pre-built input
  (`ci/bun`'s per-OS `installOnWindowsArm` is why). This issue is the missing
  other half: a factory that *constructs* those install steps. The two compose:
  `denoSteps = toolSteps(install(setupTool('denoland/setup-deno@v2','deno-version')(deno)), [...])`.

## Caveats / why this is an idea, not a mechanical edit

- **Bun's Windows-ARM fallback stays.** `installOnWindowsArm`
  (`ci/bun/module.f.ts:16`) swaps the setup action for a PowerShell `irm | iex`
  on `windows`+`arm`. `setupTool` builds the *default* branch only; the
  per-OS/arch wrapper continues to choose between it and the PowerShell variant.
- **`version` vs `<tool>-version` keys.** node/deno/bun use a tool-prefixed key;
  wasmtime/wasmer use a bare `version`. The `versionKey` parameter covers both,
  so this is not a blocker — just confirm the two families share the factory
  cleanly rather than forcing a prefixed convention.
- Mechanical savings are small (one line per tool); the value is making "install
  a pinned tool" one named recipe so a sixth tool reuses it.

## Related

- [i170](./README.md), [i171](./README.md) — the `toolSteps` step-sequence
  builder; this factory feeds it.
- [i136](./README.md), [i138](./README.md) — tool-version lock file; the pinned
  versions threaded into `setupTool` are exactly those values.
