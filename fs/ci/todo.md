# 96. CI caching.

**Priority:** P3
**Status:** open

---

# 97. Smart CA CI for FunctionalScript.

**Priority:** P3
**Status:** open

---

# 138. Implement a script that will update the lock file.

**Priority:** P3
**Status:** open
**Blocked by:** [i136](./136-ci-lock-file.md)

Implement a script that will update the lock file by reading the latest versions of tools from the internet using the instructions from [136](./136-ci-lock-file.md).

---

# 170. `fs/ci`: a shared tool step builder for bun/deno/node

**Priority:** P3
**Status:** open

The three runtime-specific CI modules each build the same job shape — "install
the tool, run its install command, run its test command, then append extra
steps, all wrapped in `clean(...)`":

```ts
// ci/bun/module.f.ts:32
export const bunSteps = (extra) => (v, a) => clean([
    installBun(v)(a),
    test({ run: 'bun install' }),
    test({ run: 'bun test --timeout 20000' }),
    ...extra,
])

// ci/deno/module.f.ts:10
export const denoSteps = (extra) => clean([
    install({ uses: 'denoland/setup-deno@v2', with: { 'deno-version': deno } }),
    test({ run: 'deno install' }),
    test({ run: 'deno task test' }),
    ...extra,
])

// ci/node/module.f.ts:15,27
export const basicNode = (version) => (extra) => clean([
    install(installNode(version)),
    test({ run: 'npm ci' }),
    ...extra,
])
const nodeSteps = (v) => [           // (not wrapped in clean — see caveats)
    install(installNode(v)),
    test({ run: 'npm ci' }),
    test({ run: 'npm t' }),
]
```

The skeleton `clean([ install(setup), …test({ run }) , ...extra ])` is repeated
verbatim. The deltas are exactly the install action and the command strings:

| | install step | commands |
|---|---|---|
| bun | `oven-sh/setup-bun@v2` (+ Windows-ARM PowerShell variant) | `bun install`, `bun test --timeout 20000` |
| deno | `denoland/setup-deno@v2` | `deno install`, `deno task test` |
| node | `actions/setup-node@v6` | `npm ci`, `npm test`, `npm run fst` (varies per builder) |

## Proposed abstraction

A `toolSteps` helper in `fs/ci/common/module.f.ts`, taking a pre-built install
`MetaStep` and a list of command strings:

```ts
// ci/common/module.f.ts
export const toolSteps =
    (setup: MetaStep, cmds: readonly string[]) =>
    (extra: readonly MetaStep[]): readonly MetaStep[] =>
        clean([setup, ...cmds.map(run => test({ run })), ...extra])
```

- `denoSteps  = toolSteps(install({ uses: 'denoland/setup-deno@v2', with: { 'deno-version': deno } }), ['deno install', 'deno task test'])`
- `bunSteps   = (extra) => (v, a) => toolSteps(installBun(v)(a), ['bun install', 'bun test --timeout 20000'])(extra)`
- node's `basicNode`/`nodeTests`/`nodeSteps` build on the same helper with their
  npm command lists.

The install step is passed in (not the raw action) precisely because bun's
install varies per `(Os, Architecture)` via `installOnWindowsArm`
(`ci/bun/module.f.ts:16`); deno and node pass a fixed `install(...)`.

## Why this qualifies

- Three real consumers (bun, deno, node), all shipping — well past the
  "second real consumer" bar.
- The shape (`clean` + install + N test commands + extra) is identical; only
  data (action descriptor, command strings) differs, which is the textbook
  case for a data-parameterized factory in `AGENTS.md`.

## Caveats / why this is an idea, not a mechanical edit

- **Partial fit for node.** `nodeMainSteps` (`ci/node/module.f.ts:38`) appends a
  TSGO `install({ run: … })` step *between* test commands, and `nodeVersions`
  uses the un-`clean`'d `nodeSteps`. The factory cleanly covers the
  install-then-commands prefix; node's bespoke tails stay as `...extra` or as
  thin wrappers over `toolSteps`.
- **`clean` boundary.** `nodeSteps` (used by `nodeVersions` at
  `ci/node/module.f.ts:33`) is deliberately *not* wrapped in `clean`, unlike the
  others. Either expose `toolSteps` returning the pre-`clean` list and let
  callers `clean` (matching `ubuntu`/`toSteps` composition), or accept a
  `clean?: boolean` flag. Decide this before implementing.
- The mechanical savings are modest (a handful of lines per module); the value
  is making the "install a runtime, run its install+test" recipe a single named
  thing, so a fourth runtime reuses it instead of forking a fourth copy.

## Related

- `fs/ci/common/module.f.ts` already centralizes `install`/`test`/`clean`/
  `ubuntu`/`toSteps`; `toolSteps` is the next composition up the same ladder.

---

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

---

# 65Z-ci-nix. Investigate Nix as a package manager for CI environments

**Priority:** P4
**Status:** open

## Summary

Nix is a purely functional package manager (not a virtualizer) that provides
reproducible, content-addressed tool environments. It is a candidate for
replacing inline tool installations (`setup-node`, `setup-bun`, etc.) on
macOS CI — and potentially Linux — without the overhead of Docker or a VM.

## What Nix is (and is not)

Nix manages tool binaries via a content-addressed store (`/nix/store`). When
you enter a Nix shell (`nix develop`), `PATH` and related env vars point at
Nix-managed binaries. **There is no virtualization**: the process runs
natively on the host OS with the host kernel, syscalls, and filesystem.

On macOS this means:
- `process.platform === 'darwin'`
- macOS-specific APIs (Keychain, FSEvents, etc.) are accessible
- Tests exercise the real macOS environment that users run on

This is the key advantage over Docker on macOS: Docker runs inside a Linux
VM (via the Docker Desktop hypervisor), so it does not test macOS behaviour.

## How it looks in GitHub Actions

Jobs and steps are unchanged. Only `run:` steps need a Nix wrapper;
`uses:` actions (including `actions/checkout`) run in the GitHub Actions
Node.js sidecar and require no changes:

```yaml
jobs:
  test:
    runs-on: macos-26
    steps:
      - uses: DeterminateSystems/nix-installer-action@v4
      - uses: DeterminateSystems/magic-nix-cache-action@v2  # caches Nix store
      - uses: actions/checkout@v5                           # unchanged
      - run: npm t
        shell: nix develop --command bash -e {0}
      - run: npm run fst
        shell: nix develop --command bash -e {0}
```

The `magic-nix-cache-action` transparently caches the Nix store between runs
so `nix develop` is fast after the first build — similar to Docker image
caching but at the granularity of individual derivations (only changed
packages are re-fetched).

Alternatively, each step can be prefixed explicitly:
```yaml
      - run: nix develop --command npm t
```

The CI generator in `fs/ci/` would emit the `shell:` override or the
`nix develop --command` prefix on `run:` steps; the overall job/step shape
stays the same.

## Platform support

| Platform | Nix viable? | Notes |
|---|---|---|
| Linux (Intel + ARM) | ✅ | Works natively; Docker is the current plan ([i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md)) |
| macOS | ✅ | **Best fit** — real macOS environment, no VM overhead |
| Windows | ❌ | WSL2 only → runs a Linux kernel, not real Windows; no advantage over Docker |

### Why Windows is out of scope

Nix on Windows requires WSL2. Inside WSL2 the kernel is Linux, so
`process.platform === 'linux'` — Windows-specific behaviour (path
separators, PowerShell, NTFS, `cmd.exe`) is not tested. GitHub-hosted
Windows runners also do not have WSL2 pre-enabled, and enabling it in CI
has known reliability issues. Windows CI therefore stays with inline
`setup-*` actions for the foreseeable future.

## Playwright caveat

Playwright's browser binaries and their system dependencies (glibc, libX11,
etc.) are notoriously difficult to express in Nix derivations. This is the
main reason [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md) chose
Docker for Linux (where Playwright runs) rather than Nix. Nix packaging of
Playwright may improve over time.

## Proposed split

| Platform | Tool management | Real OS tested? |
|---|---|---|
| Linux (Intel + ARM) | Docker image | No (Linux container) |
| macOS | Nix shell | ✅ Yes |
| Windows | Inline `setup-*` actions | ✅ Yes |

## Tasks

- [ ] Evaluate `flake.nix` / `shell.nix` for the project's macOS tool set
      (Node, Bun, Deno, Rust, Wasmtime, Wasmer)
- [ ] Benchmark cold vs warm `nix develop` times on `macos-26` runners
- [ ] Integrate `magic-nix-cache-action` and measure cache hit rate
- [ ] Decide whether the CI generator (`fs/ci/`) emits `shell:` overrides or
      explicit `nix develop --command` prefixes
- [ ] Determine if tool versions in `fs/ci/config/module.f.ts` can be
      single-sourced with `flake.nix` (e.g. via `builtins.fromJSON`)

## Related

- [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md) — Docker plan for Linux CI (chose Docker over Nix due to Playwright)
- [i145](./145-docker-linux-ci.md) — Docker containers for Linux CI jobs
- [i095](./095-ci-docker.md) — original Docker CI idea

---

# 65Z-ci-scenario-docker. Replace Ubuntu CI jobs with cached Docker images

**Priority:** P3
**Status:** open

## Problem

Ubuntu CI jobs currently install every tool (Node, Bun, Deno, Rust, Wasmtime,
Wasmer, etc.) from scratch on every run. This is slow and duplicates effort
already paid on the previous run. Additionally:

- Playwright is kept in a **separate** job on Ubuntu solely because its
  installation is expensive, fragmenting the matrix.
- The scenario tests (`./fs/emergent_testing/scenarios/run.sh`) are not run in CI at all
  because no single job has all required runners (Node, Bun, Deno, Playwright)
  at once.

## Proposal

Replace the Ubuntu jobs with Docker-container jobs that pull a pre-built,
cached image. The image is rebuilt only when a tool version changes; between
rebuilds it is pulled from the GitHub Actions cache in seconds.

### What changes

| | Today | After |
|---|---|---|
| Ubuntu (Intel + ARM) | installs tools inline each run | pulls cached Docker image |
| Playwright | separate Ubuntu job | merged into Docker Ubuntu job |
| Scenario tests | not run in CI | run inside Docker Ubuntu job |
| macOS / Windows | unchanged | unchanged (no Playwright) |

### Image contents

The Dockerfile should be **generated from `fs/ci/`** so that tool versions are
single-sourced in `fs/ci/config/module.f.ts`. The image must include everything
needed for Ubuntu CI, matching what macOS and Windows jobs install inline:

| Tool | Version source |
|------|----------------|
| Node (default) | `config.node.default` |
| Deno | `config.deno` |
| Bun | `config.bun` |
| Playwright + browsers | `config.playwright` |
| Rust toolchain | `config.actions['dtolnay/rust-toolchain']` |
| Wasmtime | `config.wasmtime` |
| Wasmer | `config.wasmer` |

`docker/Dockerfile` will be replaced by the generated one. The existing file
can serve as a reference during implementation.

### Cache key

```
linux-<arch>-node<NODE>-deno<DENO>-bun<BUN>-playwright<PW>-rust<RUST>-wasmtime<WT>-wasmer<WM>
```

Derived entirely from version constants so it self-updates on any version bump.

### Architectures

Both `ubuntu-24.04` (Intel x86-64) and `ubuntu-24.04-arm` (ARM64) run Docker
jobs — the same pair as the current Ubuntu jobs.

### What runs inside the Docker job

All tests that currently run on Ubuntu, plus:
- Playwright tests (currently a separate job)
- Scenario tests across all runners: `fjs`, `node`, `bun`, `deno`, `playwright`

## Related

- [i095](./095-ci-docker.md) — original Docker CI idea
- [i145](./145-docker-linux-ci.md) — Docker containers for Linux CI jobs (broader scope)
- i183 — scenario test infrastructure
- i65Y-scenarios-proof — scenario files converted to `export const proof`; prerequisite

---

# 667-ci-self-test-script. Add an optional package self-test script convention

**Priority:** P3
**Status:** open

## Problem

The built-in `fjs ci` generator currently needs package-aware logic for
FunctionalScript-specific self-checks. In this repository, the generated workflow
should compile `issues/demo/data/tree.json` after installing the freshly packed
tarball, but that fixture is not meaningful for projects that merely depend on
FunctionalScript.

Checking `package.json.name === "functionalscript"` works, but it keeps a
repository-specific behavior embedded in the shared CI generator. Other packages
may also want their own post-pack self-checks, and the generator should not need
to know their file layout.

## Proposal

Introduce an optional `package.json` script convention for package-specific CI
self-checks, for example:

```json
{
  "scripts": {
    "ci:self-test": "fjs compile issues/demo/data/tree.json _tree.f.js"
  }
}
```

The generated Node CI workflow can run:

```sh
npm run ci:self-test --if-present
```

after `npm pack` and `npm install -g <tarball>`. Repositories without the script
skip the hook cleanly. FunctionalScript itself can move its demo compile check
into `package.json`, removing the need for the CI generator to special-case the
package name for that step.

The package-name lookup is still useful for uninstalling the package installed
from the tarball:

```sh
npm uninstall <package.json.name> -g
```

## Open Questions

- Is `ci:self-test` the right script name, or should the convention be
  `fjs:self-test`, `ci:package-test`, or something else?
- Should Deno/Bun have equivalent optional hooks, or should this convention be
  limited to the Node/npm tarball self-check?
- Should the generator always emit `npm run ci:self-test --if-present`, or only
  emit it when `package.json.scripts["ci:self-test"]` exists at generation time?

## Tasks

- [ ] Choose and document the script name.
- [ ] Move FunctionalScript's demo compile check into that package script.
- [ ] Update `fs/ci/module.f.ts` to call the optional script instead of checking
  for `package.json.name === "functionalscript"` for the demo compile step.
- [ ] Update CI proofs for package-specific and absent-script behavior.

---

# Separate CI Job for Deno Coverage

**Priority:** P3
**Status:** open

Add a dedicated CI job that runs `deno task cov` so coverage is tracked on every PR without slowing down the main test matrix.

## Plan

- [ ] Add a `deno-coverage` job to the CI generator (`fs/ci/module.f.ts` or a new `fs/ci/deno/module.f.ts` variant) that runs `deno task cov` (runs `deno test --allow-read --allow-env && deno coverage --include='.*module\\.f\\.ts'`, matching the `npm run cov` scope).
- [ ] Decide whether to upload the coverage report (e.g. to Codecov or as a GitHub artifact).
- [ ] Run only on one platform (e.g. `ubuntu-intel`) to avoid redundancy.

---

# Replace npm-check-updates with an Internal Script

**Priority:** P3
**Status:** open

The `update` script currently uses `npx npm-check-updates -u` to bump dependency versions. Replace it with an internal FunctionalScript script so there is no runtime dependency on an external tool.

## Idea: `ci-lock.json`

Introduce a `ci-lock.json` file in each repo root that pins all CI tool versions (Node, Deno, Bun, TSGO, Wasmtime, Wasmer, runner images, GitHub Action versions). This replaces the hardcoded `fs/ci/config/module.f.ts` inside the FunctionalScript package, giving every repo that uses `fjs ci` its own updatable lock file for CI tooling — analogous to `package-lock.json` for npm deps.

The internal update script would:
1. Fetch latest versions of npm devDependencies from the registry → write `package.json` + `package-lock.json`.
2. Fetch latest versions of CI tools (Deno, Bun, Node LTS, TSGO, etc.) from their respective registries/APIs → write `ci-lock.json`.
3. Run `deno install`, `bun install`, `npm run ci-update` to propagate everything.

## Plan

- [ ] Define the `ci-lock.json` schema (tool versions + runner images + action versions).
- [ ] Implement `fjs update` (or `fjs u`) subcommand that updates `package.json` deps and `ci-lock.json` tool versions.
- [ ] Update `fs/ci/module.f.ts` to read `ci-lock.json` instead of importing `fs/ci/config/module.f.ts`.
- [ ] Bootstrap: generate a default `ci-lock.json` from the current `fs/ci/config/module.f.ts` values.
- [ ] Replace `npx npm-check-updates -u` in the `update` script with `fjs u` (or equivalent).

---

# 668-ci-npm-publish-workflow. Generate npm publishing workflow from fs/ci

**Priority:** P3
**Status:** open

## Problem

The repository has a hand-written `.github/workflows/npm-publish.yml` workflow.
The standard CI workflow is generated by `fs/ci`, but npm publishing is still
maintained separately. This creates another workflow file that can drift from
the generated CI conventions for Node versions, checkout/setup actions,
permissions, install commands, and publish behavior.

## Proposal

Extend `fs/ci` so it can generate the npm publishing workflow as well. The
generated workflow should preserve the current publish intent:

- run on pushes to `main`;
- publish to npm with provenance;
- request `id-token: write` and `contents: read` permissions;
- use the repository's current Node/npm install conventions;
- write the workflow to `.github/workflows/npm-publish.yml` unless a rename to
  `.github/workflows/npm-publishing.yml` is chosen deliberately and documented.

Document the command/API shape in `fs/ci/README.md`, including whether publish
generation is part of the existing `fjs ci` command or a separate subcommand.

## Tasks

- [ ] Decide whether npm publishing generation belongs in `fjs ci` or a separate
      command.
- [ ] Add an `fs/ci` generator for `.github/workflows/npm-publish.yml`.
- [ ] Preserve npm provenance and workflow permissions.
- [ ] Add proofs for the generated publish workflow.
- [ ] Document the generated publish workflow in `fs/ci/README.md`.

---

# CI: Package-Aware Deno, Bun, and Playwright Steps

**Priority:** P3
**Status:** open

The CI generator should opt in to Deno, Bun, and Playwright steps based on what the package actually uses, rather than always including or excluding them.

## Rules

- **Deno steps** — include only if `deno.lock` exists in the repo root.
- **Bun steps** — include only if `bun.lock` exists in the repo root.
- **Playwright steps** — include if `@playwright/test` is listed in `devDependencies` (already partially done via `playwrightJob`; make it conditional on presence in `package.json`).

## Plan

- [ ] In `fs/ci/module.f.ts`, read the repo root for `deno.lock` and `bun.lock` (via `access`) and pass the results to the job builder, analogous to how `Cargo.toml` controls Rust steps.
- [ ] Skip `denoSteps` when `deno.lock` is absent; skip `bunSteps` when `bun.lock` is absent.
- [ ] Make `playwrightJob` conditional on `@playwright/test` appearing in `devDependencies` of `package.json`.
- [ ] Update `fs/ci/proof.f.ts` to cover the new conditional logic.

---

# CI Integration Tests

**Priority:** P3
**Status:** open

Split the CI pipeline into two stages:

1. **Build stage** — a single, minimal job (e.g. Docker + Node 26) that runs unit tests (`fjs t`) and coverage, then publishes the package as a CI artifact. Platform coverage here is unimportant — FunctionalScript unit tests are platform-agnostic.
2. **Integration stage** — a broad matrix of jobs (multiple OS × architecture combinations) that each download the artifact, install it, and run scenarios. This is where platform-specific failures actually surface: a package that installs and runs correctly on Linux/x64 may fail on Windows/ARM or macOS/ARM.

The key insight: it matters far more that the *published package* works on every platform than that unit tests pass on every platform.

## Scenarios

Scenarios are expressed as FunctionalScript modules. A scenario module exports a `main` (a `NodeProgram`) that receives the environment and args and returns an effect. The CI generator reads a scenario list and emits one job per scenario.

See [669-scenario-testing.md](669-scenario-testing.md) for the scenario design — each scenario is a declarative description of initial state, an effect, and an expected result that can be run as either a unit test (mock interpreter) or a real CI job.

Open questions:
- Where do scenario modules live? (`issues/demo/` style, or a dedicated `fs/ci/scenarios/` directory?)
- How does a scenario declare which runtime(s) it targets (Node, Deno, Bun)?
- Should the artifact be a `.tgz` from `npm pack`, or a published pre-release to a local registry?

## Plan

- [ ] Define the scenario interface (`export const main: NodeProgram` or similar).
- [ ] Implement the artifact publish step in the CI generator (run `npm pack`, upload as a GitHub Actions artifact).
- [ ] Implement scenario job generation: download artifact, install, run `main`.
- [ ] Port existing demo/smoke-test steps (`fjs t`, `deno run … t`, `bunx … t`) to the scenario model.
- [ ] Document the scenario authoring convention.

---

# 669-ci-ubuntu-job-factory. Factor out the `ubuntu` / `ubuntuArm` Job builders

**Priority:** P4
**Status:** open

## Problem

`fs/ci/common/module.f.ts:98-106` defines two exported Job builders that differ
only in a single image constant:

```ts
export const ubuntu = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.intel,
    steps: toSteps(ms)
})

export const ubuntuArm = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.arm,
    steps: toSteps(ms)
})
```

The entire body — the `Job` shape, the `steps: toSteps(ms)` call — is repeated
verbatim. The only thing that varies is `'runs-on'` (`images.ubuntu.intel` vs
`images.ubuntu.arm`). This is the textbook DRY case `AGENTS.md` calls out: "two
nearly-identical functions differ only in a constant". Today there are two
runners; a third image (e.g. a future macOS or Windows runner, or a pinned
container) would mean a third copy of the same three lines.

## Proposal

Introduce a private factory parameterized by the image, then derive the two
public exports from it. This keeps the public API (`ubuntu`, `ubuntuArm`)
unchanged while removing the duplicated body:

```ts
const job = (runsOn: string) => (ms: readonly MetaStep[]): Job => ({
    'runs-on': runsOn,
    steps: toSteps(ms),
})

export const ubuntu = job(images.ubuntu.intel)
export const ubuntuArm = job(images.ubuntu.arm)
```

The factory makes adding a new runner a one-liner (`export const macos =
job(images.macos.arm)`), and it documents that "a Job is just a runner image
plus the standard step pipeline" in one place instead of implying it twice.

This is a single-module, zero-coordination change — no other module needs to
know `job` exists.

## Tasks

- [ ] Add the private `job` factory in `fs/ci/common/module.f.ts`.
- [ ] Re-express `ubuntu` and `ubuntuArm` in terms of `job`.
- [ ] Confirm `proof.f.ts` coverage still exercises both exports (they remain
      distinct exported values, so existing proofs should pass unchanged).
- [ ] Run `npx tsc` and `fjs t`.

## Related

- [i170-ci-tool-steps](./170-ci-tool-steps.md) — the `MetaStep` → `Step`
  pipeline (`toSteps`) these builders wrap.

---

# 66A-ci-cargo-step-factory. Unify the `cargo*` step builders in `fs/ci/rust`

**Priority:** P4
**Status:** open

## Problem

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

## Proposal

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

## Tasks

- [ ] Add the `cargoStep` factory and re-derive `cargoTest`,
      `cargoReleaseTest`, `cargoClippy`, `cargoReleaseClippy`, and the
      `cargoTestPair` release arm from it in `fs/ci/rust/module.f.ts`.
- [ ] Confirm the generated CI YAML is unchanged (diff the `ci` output before
      and after — `npm run ci-update` / inspect `.github/workflows`).
- [ ] Run `npx tsc` and `fjs t`; ensure `fs/ci` proofs still pass with full
      coverage.

## Related

- [i170-ci-tool-steps](./170-ci-tool-steps.md) — the sibling DRY cleanup for the
  Node version-job builders in `fs/ci/node`. Same root cause (per-variant step
  builders that differ only in command flags), different module; the two are
  independent and could land separately.
- [i175-ci-setup-tool](./175-ci-setup-tool.md), [i170-ci-tool-steps](./170-ci-tool-steps.md)
  — other `fs/ci` step-builder refactors.

---

# 66B-dockerfile-nix-integration. Generate Dockerfile with Nix toolchain from fs/ci/module.f.ts

**Priority:** P3
**Status:** open

## Problem

`docker/Dockerfile` is hand-written, installs tools via ad-hoc `curl` scripts
with no explicit version pinning, and uses `sccache` for Rust build caching.
This makes the image hard to reproduce and disconnected from the version pins
already maintained in `fs/ci/config/module.f.ts`.

The image is also not used in CI today — each Ubuntu job re-installs tools from
scratch on every run.

## Proposal

### 1. Remove `sccache`

Drop the `cargo install sccache` step and the `RUSTC_WRAPPER=sccache` env var.
`sccache` adds an extra build layer that doesn't integrate well with our setup
and is unnecessary overhead for the current codebase size. This can be
reconsidered if the Rust compilation time grows significantly.

### 2. Replace curl-based installs with Nix

Use [Nix](https://nixos.org/) (single-user install) as the package manager
inside the image. Nix provides reproducible, content-addressed tool environments
and works on any Linux base image.

### 3. Version-pin all tools via Nix, sourced from `fs/ci/config/module.f.ts`

| Tool | Version source |
|------|----------------|
| Node (default) | `config.node.default` |
| Deno | `config.deno` |
| Bun | `config.bun` |
| Rust toolchain | `config.actions['dtolnay/rust-toolchain']` |
| Wasmtime | `config.wasmtime` |
| Wasmer | `config.wasmer` |
| Playwright + browsers | `config.playwright` |

`fs/ci/config/module.f.ts` remains the single source of truth for all version
pins across both the generated workflow YAML and the Dockerfile.

### 4. Generate `docker/Dockerfile` from `fs/ci/module.f.ts`

Mirror the pattern used for `.github/workflows/ci.yml`: add a
`writeDockerfile` export (or equivalent) to `fs/ci/module.f.ts` that renders
and writes `docker/Dockerfile` from the same config. Version bumps in
`config/module.f.ts` then propagate to both the CI workflow and the Dockerfile
in a single place.

### 5. Dedicated `docker-build` CI job with GitHub Actions cache

Add a GitHub Actions job that:

1. Computes the cache key from the version pins (same scheme as
   [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md)):
   `linux-<arch>-node<NODE>-deno<DENO>-bun<BUN>-playwright<PW>-rust<RUST>-wasmtime<WT>-wasmer<WM>`
2. Attempts to restore the image from `actions/cache`.
3. Builds the image on a cache miss.
4. Saves the image as a GitHub Actions **artifact** so downstream jobs can
   pull it without rebuilding.

### 6. Downstream jobs consume the single cached image

All Ubuntu CI jobs (`needs: docker-build`) restore the artifact, `docker load`
the image, and run their steps inside the container. One image is built once
per workflow run and shared by all jobs — including the Playwright job, which
can be merged back into the main Ubuntu matrix rather than running separately.

## Benefits

- **Reproducibility** — Nix gives content-addressed installs; curl scripts can
  silently pull different versions on different days.
- **Developer / CI parity** — developers build or pull the same image used in CI.
- **Single source of truth** — all version pins live in `config/module.f.ts`.
- **Efficiency** — one Docker build per version-pin change; all parallel jobs
  reuse the cached image.

## Tasks

- [ ] Add `writeDockerfile` to `fs/ci/module.f.ts` (and wire it into the
      existing `main`/`ci` entry-point).
- [ ] Write the Dockerfile template: Debian base → install Nix → `nix-env -i`
      each tool at the pinned version.
- [ ] Remove `sccache` install and `RUSTC_WRAPPER` env from the generated file.
- [ ] Add the `docker-build` GitHub Actions job (Intel + ARM variants) with
      cache-key computation and artifact upload.
- [ ] Update downstream Ubuntu jobs to `docker load` the artifact and run
      inside the container.
- [ ] Merge the standalone `playwright` job into the Docker Ubuntu job.
- [ ] Confirm the generated CI YAML and Dockerfile are regenerated consistently
      by `npm run ci-update` (or equivalent).

## Related

- [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md) — Docker plan for
  Ubuntu CI jobs; this issue implements it and adds the Nix layer.
- [i65Z-ci-nix](./65Z-ci-nix.md) — Nix as CI package manager; macOS/Windows
  stay with inline `setup-*` actions; Linux uses Nix-inside-Docker.
- [i145](./145-docker-linux-ci.md) — Docker containers for Linux CI jobs.
- [i095](./095-ci-docker.md) — original Docker CI idea.
- [i096](./096-ci-caching.md) — CI caching.

---

# 66H-ci-npm-global-install. `fs/ci`: an `npmGlobalInstall` factory for global npm tool steps

**Priority:** P4
**Status:** open

## Problem

Three CI step sites build the identical `run`-based step "globally install a
pinned npm package", differing only in the package name and version value:

```ts
// fs/ci/node/module.f.ts:25-26
const fjsGlobalInstall = (version: string): MetaStep =>
    install({ run: `npm install -g functionalscript@${version}` })

// fs/ci/node/module.f.ts:47
install({ run: `npm install -g @typescript/native-preview@${tsgo}` }),

// fs/ci/playwright/module.f.ts:20
install({ run: `npm install -g playwright@${playwright}` }),
```

The shape `install({ run: \`npm install -g ${pkg}@${version}\` })` is repeated
verbatim. The deltas are exactly the package name and the pinned version:

| | package | version |
|---|---|---|
| node (fjs)  | `functionalscript`              | `version` (param) |
| node (tsgo) | `@typescript/native-preview`    | `tsgo` (from config) |
| playwright  | `playwright`                    | `playwright` (from config) |

A reader has to parse three template strings to notice they are the same
recipe, and a fourth global-install tool would fork a fourth copy.

## Proposed abstraction

A small factory in `fs/ci/common/module.f.ts` — the module that already
centralizes `install`/`test`/`clean`/`uses`/`toSteps` — capturing "globally
install one pinned npm package":

```ts
export const npmGlobalInstall =
    (pkg: string) =>
    (version: string): MetaStep =>
        install({ run: `npm install -g ${pkg}@${version}` })
```

The call sites collapse to point-free or one-argument calls:

```ts
// fs/ci/node/module.f.ts
const fjsGlobalInstall = npmGlobalInstall('functionalscript')
// ...
npmGlobalInstall('@typescript/native-preview')(tsgo),

// fs/ci/playwright/module.f.ts
npmGlobalInstall('playwright')(playwright),
```

`fjsGlobalInstall` reduces to a point-free binding — the same style as
`installNode = setupTool('actions/setup-node@v6', 'node-version')` proposed in
[i175](./175-ci-setup-tool.md).

## Why this qualifies

- Three real call sites today, all shipping — past the second-consumer bar.
- Identical shape, only data (package name, version) varies — the textbook
  `AGENTS.md` data-parameterized-factory case.
- It is **complementary to, not a duplicate of,
  [i170](./170-ci-tool-steps.md) and [i175](./175-ci-setup-tool.md)**, which
  cover two different axes of CI step construction:
  - i170 `toolSteps(setup, cmds)` — the *install-then-test step sequence*.
  - i175 `setupTool(uses, versionKey)` — `uses`-based GitHub Actions *setup*
    steps (`install({ uses, with: { '<x>-version': v } })`).
  - This issue — `run`-based *shell* steps (`install({ run: 'npm install -g …' })`).

  These are three distinct step kinds. `setupTool` builds `uses` steps;
  `npmGlobalInstall` builds `run` steps; neither subsumes the other.

## Caveats / why this is an idea, not a mechanical edit

- **Currying direction.** Currying as `(pkg) => (version) =>` lets
  `fjsGlobalInstall = npmGlobalInstall('functionalscript')` read point-free,
  matching i175's `installNode` binding. A two-argument
  `(pkg, version)` form is equally valid if the point-free binding is not
  wanted — decide alongside i175's shape so the two factories stay consistent.
- **Mechanical savings are small** (one line per site); the value is making
  "globally install a pinned npm tool" one named recipe so a fourth tool reuses
  it instead of hand-spelling a fourth `npm install -g` template.
- **Proof coverage.** `fs/ci/proof.f.ts` already exercises the generated
  workflow; confirm the three steps it produces are byte-identical before and
  after, and that every branch of the new factory is covered (all three
  consumers call it, so 100% coverage falls out).

## Tasks

- [ ] Add `npmGlobalInstall` to `fs/ci/common/module.f.ts`.
- [ ] Rebind `fjsGlobalInstall` and the two inline `npm install -g` steps in
      `fs/ci/node/module.f.ts` and `fs/ci/playwright/module.f.ts` to it.
- [ ] Confirm `npx tsc` is clean and `fjs t` passes; verify the generated
      workflow YAML is unchanged.

## Related

- [i170](./170-ci-tool-steps.md) — `toolSteps` step-sequence builder (different
  axis: the install+test sequence).
- [i175](./175-ci-setup-tool.md) — `setupTool` for `uses`-based setup steps
  (different axis: GitHub Actions setup actions). This issue is the `run`-based
  sibling.

---

