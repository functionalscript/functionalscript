## 66A-ci-cargo-step-factory. Unify the `cargo*` step builders in `fjs/ci/rust`

**Priority:** P4
**Status:** open

### Problem

**Note: the `wasm` migration reshaped this code, and this issue has not been
restated against it.** Those builders returned `MetaStep`s; they now return
command strings, because the WASM job wraps its commands in its flake's `run`
script while the platform matrix wraps the same commands in plain steps, so the
two families share commands rather than steps. The duplication this issue is
about survived that change, in a smaller form — read the Proposal below as the
idea rather than as a patch that would apply.

`fjs/ci/rust/module.f.mjs` builds `cargo` command strings by concatenating
suffixes (`--release`, `-- -D warnings`) onto `cargoCommand(...)`:

```ts
const cargoClippy = (target?: string): string =>
    `${cargoCommand('clippy', target)} -- -D warnings`

const cargoReleaseClippy = (target?: string): string =>
    `${cargoCommand('clippy', target)} --release -- -D warnings`

const targetCheckCommands = (target?: string): readonly string[] => [
    cargoCommand('test', target),
    `${cargoCommand('test', target)} --release`,
    cargoClippy(target),
    cargoReleaseClippy(target),
]

const cargoTestPairCommands = (target: string, config: string): readonly string[] => {
    const main = cargoCommand('test', target, config)
    return [main, `${main} --release`]
}
```

`--release` is now spelled four times and `-- -D warnings` twice — down from the
five and three this issue was filed against, since the per-variant `cargoTest`
and `cargoReleaseTest` builders are gone. What is left is the same construction:

> `cargoCommand(tool, target, config) + maybe " --release" + maybe " -- -D warnings"`

varying along three axes only:

| axis | values |
|------|--------|
| tool | `'test'` \| `'clippy'` |
| release | with / without `--release` |
| warnings | the `-- -D warnings` suffix — **always present iff `tool === 'clippy'`** |

The `warnings` axis is not independent: it is fully determined by `tool`. So
the entire family is really a 2×2 grid (tool × release) with the warnings
suffix derived from the tool. Spelling out each cell as its own named builder —
each re-typing the template string and the suffix concatenation — is the DRY
smell: adding a new dimension (say a `--features` flag) means editing every
builder, and the `--release` text is duplicated four times.

### Proposal

Introduce a single `cargoStep` factory parameterized by tool and a small
options record, and derive the named builders from it. The warnings suffix is
computed from the tool, not passed in:

```ts
type CargoOptions = {
    readonly target?: string
    readonly config?: string
    readonly release?: boolean
}

const cargo = (tool: 'test' | 'clippy') => (o: CargoOptions): string => {
    const release = o.release ? ' --release' : ''
    const warnings = tool === 'clippy' ? ' -- -D warnings' : ''
    return `${cargoCommand(tool, o.target, o.config)}${release}${warnings}`
}
```

Then `targetCheckCommands` and `cargoTestPairCommands` are built from it, the
`--release` and `-- -D warnings` strings each appear exactly once, and the
"clippy implies warnings" invariant lives in one place. The exported surface
(`rustPlatformSteps`, `rustWasmSteps`, `wasmNixJob`) is unchanged, and the
generated workflow YAML is byte-identical.

`targetCheckCommands` can optionally be re-expressed as the cross product of
`{ false, true }` (release) × `{ test, clippy }`, but that is a follow-up
nicety — the core win is collapsing the hand-spelled templates into one
factory.

### Tasks

- [ ] Restate the proposal against the current command builders, which return
      strings rather than `MetaStep`s.
- [ ] Add the `cargo` factory and re-derive `cargoClippy`,
      `cargoReleaseClippy`, `targetCheckCommands` and `cargoTestPairCommands`
      from it in `fjs/ci/rust/module.f.mjs`.
- [ ] Confirm the generated CI YAML is unchanged (diff the `ci` output before
      and after — `npm run gen` / inspect `.github/workflows`).
- [ ] Run `tsc` and `fjs t`; ensure `fjs/ci` proofs still pass with full
      coverage.

### Related

- [i170-ci-tool-steps](./170-ci-tool-step-builder.md) — the sibling DRY cleanup for the
  Node version-job builders in `fjs/ci/node`. Same root cause (per-variant step
  builders that differ only in command flags), different module; the two are
  independent and could land separately.
- [i175-ci-setup-tool](./175-ci-setup-tool-factory.md), [i170-ci-tool-steps](./170-ci-tool-step-builder.md)
  — other `fjs/ci` step-builder refactors.
