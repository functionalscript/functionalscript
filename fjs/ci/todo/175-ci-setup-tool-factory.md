## 175. `fjs/ci`: a `setupTool` factory for pinned-version install steps

**Priority:** P3
**Status:** open

Three CI modules construct a GitHub Actions "setup" step with the identical
shape `install({ uses: '<action>', with: { '<x>-version': <pinnedVersion> } })`,
differing only in the action string and the version key/value:

```ts
// ci/node/module.f.mjs
const installNode = (version: string) =>
    ({ uses: 'actions/setup-node@v7', with: { 'node-version': version } })

// ci/rust/module.f.mjs
install({ uses: 'bytecodealliance/actions/wasmtime/setup@v1', with: { version: wasmtime } })
install({ uses: 'wasmerio/setup-wasmer@v3.1', with: { version: `v${wasmer}` } })
```

It used to be five. Deno's and Bun's setup steps went when those jobs moved to Nix:
their runtime comes from a generated flake now, and the only action either installs is
`cachix/install-nix-action`, which takes no version input. `installNode` survives
because the platform matrix and `package-check` still use it.

### Proposed abstraction

A small factory in `fjs/ci/common/module.f.mjs` that captures "a setup action
parameterized by one pinned version":

```ts
export const setupTool =
    (uses: string, versionKey: string) =>
    (version: string): Step =>
        ({ uses, with: { [versionKey]: version } })
```

- `installNode  = setupTool('actions/setup-node@v7', 'node-version')`
- wasmtime / wasmer = `setupTool('bytecodealliance/actions/wasmtime/setup@v1', 'version')`
  and `setupTool('wasmerio/setup-wasmer@v3.1', 'version')` (wasmer keeps its
  `v${...}` formatting at the call site).

### Why this qualifies

- Three real call sites today, all shipping — down from five, but still past the
  "second real consumer" bar.
- It is the textbook `AGENTS.md` case: identical shape, only data (action
  descriptor, version key/value) varies.
- It was **complementary to, not a duplicate of, [i170](./170-ci-tool-step-builder.md)**:
  that issue extracted the *step sequence* and took the install step as a pre-built
  input, while this one constructs those install steps. i170 is `irrelevant` now, so
  this stands alone — which makes it smaller, not blocked.

### Caveats / why this is an idea, not a mechanical edit

- **`version` vs `<tool>-version` keys.** Node uses a tool-prefixed key;
  wasmtime/wasmer use a bare `version`. The `versionKey` parameter covers both,
  so this is not a blocker — just confirm the two families share the factory
  cleanly rather than forcing a prefixed convention.
- **The remaining call sites may not stay.** `installNode`'s two consumers are the
  platform matrix and `package-check`, and
  [built-package-checks](built-package-checks.md) proposes reworking the first. If a
  future issue moves the Rust tools to a flake as the runtimes went, this factory
  runs out of call sites the way `toolSteps` did — check the count before building
  it.
- Mechanical savings are small (one line per tool); the value is making "install
  a pinned tool" one named recipe so a fourth tool reuses it.

### Related

- [i170](./170-ci-tool-step-builder.md) — the `toolSteps` step-sequence builder this
  factory was to feed, now `irrelevant`: the Nix migration took the two consumers it
  counted on. This entry used to read `i170/i171`, but the retired `i171` is not a CI
  issue: it was `tf: stop relying on JS function names to detect throw tests`,
  resolved **won't fix** with the reason recorded in `parseTestSet`'s JSDoc in
  [`fjs/emergent_testing/module.f.mjs`](../../emergent_testing/module.f.mjs).
  `i170` alone is the `toolSteps` work, as the citations in
  [66h-ci-npm-global-install](./66h-ci-npm-global-install.md) and
  [66a-ci-cargo-step-factory](./66a-ci-cargo-step-factory.md) already have it.
- `i136` (retired; shipped as [`fjs/ci/config/module.f.mjs`](../config/module.f.mjs)),
  [i138](./138-lock-file-update-script.md) — tool-version lock file; the pinned versions threaded into
  `setupTool` are exactly the values that module exports. Making the lock
  loadable as JSON instead is
  [replace-npm-check-updates-with-an-internal-script](./replace-npm-check-updates-with-an-internal-script.md).
