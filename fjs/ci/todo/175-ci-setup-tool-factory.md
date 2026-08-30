## 175. `fjs/ci`: a `setupTool` factory for pinned-version install steps

**Priority:** P3
**Status:** irrelevant — one call site left, which is nothing to factor

### Why this closed

The previous revision set the criterion and the migrations met it: *"if `bun`
migrates, `installNode` is the only caller left and the factory has nothing to
factor."* `bun` migrated, so `installNode` is the only caller left.

What is worth keeping is the shape of the decision, since
[i170](./170-ci-tool-step-builder.md) cites it: an abstraction justified by a count
has to be re-checked when the count moves, and here it moved *down* four times
without anyone revisiting the premise. Deno, Wasmtime, Wasmer and Bun each removed a
call site by moving into a generated Nix flake, where the only action is
`cachix/install-nix-action` and it takes no version input.

If a second setup action ever appears, reopen this rather than reasoning from the
version below — the counts in it are historical now.

### Original report

Two CI modules construct a GitHub Actions "setup" step with the identical
shape `install({ uses: '<action>', with: { '<x>-version': <pinnedVersion> } })`,
differing only in the action string and the version key/value:

```ts
// ci/node/module.f.mjs
const installNode = (version: string) =>
    ({ uses: 'actions/setup-node@v7', with: { 'node-version': version } })

// ci/bun/module.f.mjs
install(uses('oven-sh/setup-bun', { 'bun-version': bun }))
```

**It used to be five, and the trend is the point.** Deno's went when that job moved
to Nix; Wasmtime's and Wasmer's went with `wasm`, whose runtimes now come from its
flake. A migrated job installs `cachix/install-nix-action`, which takes no version
input, so it is not a call site at all. `installNode` survives because the platform
matrix and `package-check` still use it, and `setup-bun` because that job's migration
was, at the time, waiting on Nixpkgs.

Two call sites is the bar this repository sets, not comfortably past it, and one of
the two is expected to go. **Decide whether this is still worth doing before doing
it**: if `bun` migrates, `installNode` is the only caller left and the factory has
nothing to factor.

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
- `installBun   = setupTool('oven-sh/setup-bun@v2', 'bun-version')` — gone with the
  Bun migration
There is no third: the Wasmtime and Wasmer lines this issue used to name are gone
with the `wasm` migration.

### Why this qualifies

- Two real call sites today, both shipping — down from five, and exactly at the
  "second real consumer" bar rather than past it.
- It is the textbook `AGENTS.md` case: identical shape, only data (action
  descriptor, version key/value) varies.
- It was **complementary to, not a duplicate of, [i170](./170-ci-tool-step-builder.md)**:
  that issue extracted the *step sequence* and took the install step as a pre-built
  input, while this one constructs those install steps. i170 is `irrelevant` now, so
  this stands alone — which makes it smaller, not blocked.

### Caveats / why this is an idea, not a mechanical edit

- **`version` vs `<tool>-version` keys.** Node and Bun use a tool-prefixed key;
  wasmtime/wasmer use a bare `version`. The `versionKey` parameter covers both,
  so this is not a blocker — just confirm the two families share the factory
  cleanly rather than forcing a prefixed convention.
- **The remaining call sites may not stay.** `installNode`'s two consumers are the
  platform matrix and `package-check`, and
  [built-package-checks](built-package-checks.md) proposes reworking the first;
  `setup-bun` goes as soon as Nixpkgs packages a usable Bun. If a future issue moves
  the Rust tools to a flake as the runtimes went, this factory runs out of call sites
  the way `toolSteps` did — check the count before building it.
- Mechanical savings are small (one line per tool); the value is making "install
  a pinned tool" one named recipe so a fifth tool reuses it.

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
