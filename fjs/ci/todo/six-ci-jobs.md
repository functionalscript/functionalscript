## Six CI jobs

**Priority:** P3
**Status:** open

### Problem

CI separates platform jobs from the Node, Deno and Bun jobs. This repeats
environment setup and makes a change wait for additional runner assignments.
The checks have different coverage needs: native Rust depends on OS and CPU,
pure FunctionalScript needs engine diversity, host JavaScript needs OS and
runtime coverage, and TypeScript needs one type-check.

The earlier proposal concentrated the canonical checks in `ubuntu-arm`.
The revised proposal distributes them across the six OS/CPU jobs below.

### Proposal

Use the existing platform job names and the exact tool and image pins in
[`../config/module.f.js`](../config/module.f.js).

| Job | Rust targets | Pure FJS | JS effects and host adapters | TypeScript |
| --- | --- | --- | --- | --- |
| `macos-intel` | Native x86-64 | — | — | — |
| `macos-arm` | Native ARM64 | — | Node, Deno, Bun | — |
| `ubuntu-intel` | Native x86-64 and Linux i686 | Node coverage; Bun and SpiderMonkey tests | — | — |
| `ubuntu-arm` | Native ARM64 and existing WASM targets | — | Node, Deno, Bun | `tsc` |
| `windows-intel` | Native x86-64 and Windows i686 | — | — | — |
| `windows-arm` | Native ARM64 | — | Node, Deno, Bun | — |

The i686 entries are additional targets executed on the corresponding x86-64
runner; they do not require additional jobs or a 32-bit host OS.

#### Test runners

- Pure FJS covers V8 through Node, JavaScriptCore through Bun, and SpiderMonkey
  through its shell. Node uses its native test runner for coverage because
  `fjs t` has no coverage support. Bun and SpiderMonkey use the repository's
  own runner from the checked-out revision.
- JS effects and host adapters use each runtime's native test runner:
  `node --test`, `deno test` and `bun test`, with the suite's required options
  and permissions. Each runs on Linux, macOS and Windows.
- Type checking runs once, on Linux ARM64.

Define the test selection explicitly when splitting the suites. Every authored
FJS proof must remain in each engine's FJS suite, and every applicable host
proof must remain in each OS/runtime JS suite. Reuse the existing test
discovery and adapters rather than copying tests for each runner. Engine
coverage alone does not establish browser DOM or browser-integration coverage.

This deliberately covers native Rust on every listed OS/CPU pair and JS effects
on every listed OS/runtime pair. It does not claim every JS runtime on both
CPU architectures. Verify that the ARM jobs install native ARM64 runtimes.

#### Deferred installation checks

Remove the installed `fjs` check and the npm package-consumer check from this
CI layout until a better solution is selected. This defers installation and
distribution testing; it does not remove the in-repository runner used for
the Bun and SpiderMonkey FJS suites or the compiler checks.

Track the replacement in
[installed CLI and npm package checks](./built-package-checks.md), including
the option of a separate pipeline in another repository installing from
`main`. Publishing the npm package remains a separate concern.

#### Existing checks to preserve

Moving checks into the six jobs must preserve checks other than the installation
checks explicitly deferred above:

- Native and i686 Rust tests and Clippy, including the existing debug/release
  checks and warnings policy; `cargo fmt -- --check` once.
- The existing WASM targets and their configured execution coverage. State
  each target and runtime explicitly: compiling a target is not the same as
  executing its tests. Do not assume that selecting the Wasmer Cargo config
  makes every target use Wasmer; unoverridden runners inherit the default
  Cargo config.
- `npm start compile`, which checks authored `.f.js` with this revision's
  compiler, and SpiderMonkey's existing compile check alongside its tests.
- Generation and the generated-file drift check, including generation needed
  by the WASM demos. Run the drift comparison after the relevant steps that
  write into that checkout.

Assign the platform-independent compile and generation steps within the Linux
jobs when implementing the split. Their placement can follow measured job
duration; it does not require an additional job.

#### Migration constraints

- Keep each command separately reportable as required by
  [AGENTS.md](../../../AGENTS.md#7-continuous-integration).
- Share environment setup within each job. Check the selected runtime versions
  before running project code and preserve the existing direct-tool setup for
  platforms without the shared Nix shell.
- Update generated-workflow proofs when removing the standalone runtime jobs.
  A proof about a removed job must move to its new owner rather than pass
  vacuously because the job disappeared.
- Update [Smart CI](../cache/README.md) classification and cache identities to
  reflect the new suites, platforms, runtimes and runners. A cached pass for a
  different check must not satisfy a newly assigned check.
- Coordinate required-status-check changes with the workflow migration.
  Removed job names must stop being required before the switching PR enters
  the merge queue, so the queue does not wait for checks that no longer exist.
- Preserve the current trigger policy during this consolidation. The former
  proposal's separate idea of making five jobs merge-queue-only is not adopted
  by this allocation; any trigger-policy change needs its own decision.
- Measure runner waits, serial duration, disk use and runner-minutes after the
  redistribution. Set suitable job timeouts from those results. Six jobs alone
  do not establish a faster critical path.

### Tasks

- [x] Fold the former standalone WASM job into `ubuntu-arm`.
- [ ] Define separate FJS and host-JS suite selection using existing discovery.
- [ ] Restructure runtime steps so platform jobs share setup without duplicate
      installers or standalone Node, Deno and Bun jobs.
- [ ] Assign the suites to the six jobs in the table; keep native and i686 Rust
      coverage and the existing WASM checks.
- [ ] Retain compile validation, formatting and generation/drift checks in the
      six jobs.
- [ ] Remove installed-CLI and npm package-consumer checks from this CI layout;
      retain the replacement investigation in `built-package-checks.md`.
- [ ] Update workflow proofs and Smart CI cache classification for the new
      check ownership.
- [ ] Measure the resulting jobs and adjust timeouts where needed.
- [ ] Coordinate removal of obsolete required-check names before switching the
      merge-queue workflow.
- [ ] Update CI documentation and related TODOs to describe the new allocation
      and the intentional package-testing gap.

### Earlier measurements

The earlier plan and measurements are preserved in
[the prior revision](https://github.com/functionalscript/functionalscript/blob/4da35235c90519104738044ca4b7a9e9f7dea1c1/fjs/ci/todo/six-ci-jobs.md).
They measured 2026-10-08 runs between `0b5f6fdf4` and `bb2648dbb`, before
historical Node suites were removed. Concentrating the checks in one ARM job
then estimated about 21 minutes of serial work against a roughly 6.5-minute
parallel critical path. Those figures motivated measuring runner waits as
well as execution time; they are not predictions for this revised allocation.

### Related

- [Installed CLI and npm package checks](./built-package-checks.md) — replacement
  investigation for the checks temporarily removed here.
- [CI integration tests](./ci-integration-tests.md) — consumer scenarios to
  reconcile with the installation-check investigation.
- [Package-aware Deno and Bun steps](./ci-package-aware-deno-and-bun-steps.md) —
  adapt its conditions to steps within platform jobs.
- [CI generator audience](./ci-generator-audience.md) — clarify which changes
  belong to this repository's configuration and which affect `fjs ci` users.
- [CI caching](./096-ci-caching.md) and [Smart CI](../cache/README.md) — preserve
  check identities and measure setup costs after redistribution.
- [Wasmtime threads](./wasmtime-threads-cell-until-47.md) — existing WASM runtime
  coverage decision, independent of the six-job allocation.
- [Nix alternatives](./investigate-mise-pixi.md) — investigate environment
  tooling independently; this allocation does not select a replacement.
