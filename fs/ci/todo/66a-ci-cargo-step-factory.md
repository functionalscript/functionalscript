## 66A-ci-cargo-step-factory. Unify the `cargo*` step builders in `fs/ci/rust`

**Priority:** P4
**Status:** open

### Problem

`fs/ci/rust/module.f.ts` defines a family of one-line `MetaStep` builders that
all wrap `cargoCommand(...)` and differ only by which suffixes (`--release`,
`-- -D warnings`) they concatenate:

```ts
// fs/ci/rust/module.f.ts:18-39
const cargoTest = (target?: string, config?: string): MetaStep =>
    test({ run: cargoCommand('test', target, config) })

const cargoClippy = (target?: string): MetaStep =>
    test({ run: `${cargoCommand('clippy', target)} -- -D warnings` })

const cargoReleaseClippy = (target?: string): MetaStep =>
    test({ run: `${cargoCommand('clippy', target)} --release -- -D warnings` })

const cargoTestPair = (target: string, config?: string): readonly MetaStep[] => {
    const main = cargoCommand('test', target, config)
    return [
        cargoTest(target, config),
        test({ run: `${main} --release` })
    ]
}

const cargoReleaseTest = (target?: string): MetaStep =>
    test({ run: `${cargoCommand('test', target)} --release` })
```

These four single-step builders (`cargoTest`, `cargoClippy`,
`cargoReleaseClippy`, `cargoReleaseTest`) — plus the `--release` arm inlined
inside `cargoTestPair` — are the same construction repeated five times:

> `test({ run: cargoCommand(tool, target, config) + maybe " --release" + maybe " -- -D warnings" })`

They vary along three orthogonal axes only:

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

const cargoStep = (tool: 'test' | 'clippy') => (o: CargoOptions): MetaStep => {
    const release = o.release ? ' --release' : ''
    const warnings = tool === 'clippy' ? ' -- -D warnings' : ''
    return test({ run: `${cargoCommand(tool, o.target, o.config)}${release}${warnings}` })
}

const cargoTest = (target?: string, config?: string) => cargoStep('test')({ target, config })
const cargoReleaseTest = (target?: string) => cargoStep('test')({ target, release: true })
const cargoClippy = (target?: string) => cargoStep('clippy')({ target })
const cargoReleaseClippy = (target?: string) => cargoStep('clippy')({ target, release: true })

const cargoTestPair = (target: string, config?: string): readonly MetaStep[] =>
    [cargoTest(target, config), cargoStep('test')({ target, config, release: true })]
```

Now the `--release` / `-- -D warnings` strings each appear exactly once, the
"clippy implies warnings" invariant is encoded in one place, and the existing
public surface (`targetChecks`, `rustTarget`, `wasmTarget`,
`rustPlatformSteps`, `rustWasmSteps`) is unchanged because the named builders
keep their signatures. The generated workflow YAML is byte-identical.

`targetChecks` (`:41`) can optionally be re-expressed as the cross product of
`{ false, true }` (release) × `{ test, clippy }`, but that is a follow-up
nicety — the core win is collapsing the five hand-spelled templates into one
factory.

### Tasks

- [ ] Add the `cargoStep` factory and re-derive `cargoTest`,
      `cargoReleaseTest`, `cargoClippy`, `cargoReleaseClippy`, and the
      `cargoTestPair` release arm from it in `fs/ci/rust/module.f.ts`.
- [ ] Confirm the generated CI YAML is unchanged (diff the `ci` output before
      and after — `npm run ci-update` / inspect `.github/workflows`).
- [ ] Run `npx tsc` and `fjs t`; ensure `fs/ci` proofs still pass with full
      coverage.

### Related

- [i170-ci-tool-steps](todo.md) — the sibling DRY cleanup for the
  Node version-job builders in `fs/ci/node`. Same root cause (per-variant step
  builders that differ only in command flags), different module; the two are
  independent and could land separately.
- [i175-ci-setup-tool](todo.md), [i170-ci-tool-steps](todo.md)
  — other `fs/ci` step-builder refactors.
