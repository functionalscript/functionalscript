## Six CI jobs: one primary, five cross-platform

**Priority:** P3
**Status:** open

### Problem

`gen.ci.yml` runs twelve jobs: the six platform jobs (`job` in
`../module.f.mjs`) and the six toolchain jobs (`canonicalJobs`: `wasm`, `deno`,
`bun`, and `nodeVersionJobs`' `node22`, `node24`, `node26`). Even with the
macOS and Windows jobs held to the merge queue (`Setup.mergeQueueOnly`), every
pull-request commit still starts eight jobs, and that costs more than the work
in them:

- **A pull request waits for many runners.** Seven of the eight jobs run on
  `ubuntu-26.04-arm`, the congested pool, so a pull request waits for the
  slowest of seven runner assignments rather than for its work.
- **Work is repeated.** Each job installs Nix, checks out, and realizes its
  shell, and `ubuntu-arm`'s `node --test` runs the same suite, on the same
  system, shell and Node, as `node26`'s `npm run cov`, which adds only
  coverage on top.
- **Every toolchain is a required check.** The `main` ruleset names each job,
  so adding, renaming or folding a toolchain job is a ruleset edit made in
  step with the pull request that does it.

### Proposal

Six jobs, split by what they prove.

1. **`ubuntu-arm`, the primary job** — runs on every pull-request commit and
   in the merge queue, and runs everything that can run on `aarch64-linux`:
   `tsc` and `npm start compile`, Node 26 with coverage, Node 22 and Node 24,
   Deno, Bun, Rust native and every WASM target with both WASM runtimes, the
   generated-file drift check, and the packed-package check.
2. **Five cross-platform jobs** — `ubuntu-intel`, `macos-intel`, `macos-arm`,
   `windows-intel`, `windows-arm` — check that FunctionalScript works on each
   platform: the suite, which exercises host adapters such as `fjs/effects/node`
   whose behaviour differs by OS, and each platform's native Rust, the part
   whose build depends on the target. `ubuntu-intel` keeps the 32-bit Linux
   checks, which only the `x86_64-linux` shell can carry.

The five run in the merge queue only when `Setup.mergeQueue` is `true`, by
carrying `if: github.event_name == 'merge_group'`; otherwise they run on every
pull-request commit too. The default is `false`, because a project without a
merge queue would never run them: the built-in `fjs ci` passes nothing, and
`../self/module.f.mjs` passes `true`.

The job keeps the name `ubuntu-arm` so the ruleset gains no new name. The
primary keeps every toolchain a pull request is gated on today except the
`x86_64-linux` shell — its native Rust and the 32-bit target — which moves to
the queue with `ubuntu-intel`.

#### Measured cost

Measured over the CI runs of 2026-10-08, with `main` between `0b5f6fdf4` and
`bb2648dbb`. Most of those runs predate `f7b42b9de` (#2688), when macOS and
Windows still ran on every pull request, so job run times hold for the new
layout while the runner waits overstate the load it would see:

- When ARM waits were longest, dozens of this repository's own ARM jobs were
  queued ahead while only a handful ran: the congestion is this repository's
  own backlog.
- The primary job runs serially for about 21 minutes. At those commits the
  critical path, `node26`, was about 6.5 minutes, so feedback with idle runners
  is about three times slower. Under that day's congestion the median pull
  request would finish sooner than then — about 36 minutes against 45 — if its
  one runner wait is as short as that day's first ARM job's; as long as a
  typical ARM job's, it is no better.
- Runner-minutes per pull-request commit fall by about a quarter, counting
  `ubuntu-intel` moving to the queue. Most of the primary job's time is five
  test suites, each in one process, so combining them saves the repeated setup
  and the duplicate `node --test` rather than the suites themselves.
- A merge-queue run's critical path, without runner waits, goes from
  `macos-intel`'s about 9 minutes to the primary's about 21, which lowers how
  many entries the queue can merge in an hour.

#### Constraints the generator has to meet

- **Step order inside one job.** The version checks are the job's first
  commands, all of them, as `nixVersionChecks` in `../proof.f.mjs` requires:
  `npm ci`, `deno install` and `cargo test` run project code on a runtime no
  check has confirmed yet otherwise. `tsc` comes before `npm pack`, whose
  `prepack` writes declarations beside the sources. `npm pack` packs files
  matching `files` even when they are ignored, so it runs before any non-Node
  step can write into the checkout. The drift check comes after every step that
  writes to the tree — it is the last word on the tree. `nodeExtra`'s injected
  steps come after the drift check, as they ran in a job without one, and
  `setup-node` with the packed-package check comes last, because `setup-node`
  changes `PATH` for every step after it.
- **One checkout, several installers.** Each Node runs `npm ci` in its own
  flake directly before its suite, so each suite runs on an install its own
  npm made, and Deno and Bun each install directly before their own suite.
  The proof that `deno` and `bun` run no `npm ci` cannot move to a job that
  runs it; that property stays pinned by the exact command lists in
  `../deno/proof.f.mjs` and `../bun/proof.f.mjs`.
- **One Nix installer.** Each tool's steps (`rustWasmSteps`, `denoSteps`,
  `bunSteps`, `suiteNixSteps`, `node26Steps`, `shellPlatformSteps`) carry
  their own `nixInstall`, and `toSteps` does not merge duplicates. They have to
  split into version checks and commands before one job can carry them all.
- **Several flakes in one job.** The primary enters the shared shell and the
  Node 22 and Node 24 flakes, a step at a time. `nixCoverage` asserts one
  flake per job, and each of those two flakes takes its id from the job that
  enters it; both rules move from jobs to steps.
- **Failures stop the job.** The first red step skips everything after it, and
  `stepSchema` models no step-level `if`. Order the fast gates first —
  `cargo fmt`, `tsc`, `npm start compile` — so the common failures show early;
  the drift check cannot join them.
- **The run limit.** `jobTimeout` in `../config/module.f.js` is under the
  primary's serial time. The primary needs a limit of its own; the five and
  `publish-npm` keep `jobTimeout`, so a hung shell build still frees its runner.
  The merge queue's status check timeout has to cover the primary's run plus a
  runner wait.
- **Proofs keyed on job ids.** `matrixShape` counts twelve jobs. An assertion
  that a removed job does *not* run something would pass because the job is
  gone, so each moves to the primary rather than being deleted with it. The
  Wasmtime threads guard needs more than a move: it compares against the bare
  `cargo test --target wasm32-wasip1-threads` while every step is wrapped in the
  shell, so it cannot fail today either; key it on the wrapped command.
- **What a project's pull requests run.** The primary's Node 26 suite is
  `npm run cov`. That is this repository's `node --test` with coverage, and so
  is the one `../README.md` documents, but for any project using `fjs ci`,
  `cov` becomes the only Node 26 suite its pull requests run.
- **Disk.** One `ubuntu-arm` runner holds every toolchain closure, the
  `target/` directory for native and every WASM target, and the dependency
  installs of three package managers. Measure it on a trial run first.
- **Intel Linux on pull requests.** With `ubuntu-intel` in the queue, no
  pull-request commit builds the `x86_64-linux` shell, runs the suite or native
  Rust on it, or runs the 32-bit checks; a failure there shows only as a
  merge-queue eviction. WASM still checks a 32-bit pointer width on every
  commit.

#### Alternative

Hold all six platform jobs to the merge queue and keep the toolchain jobs
parallel, moving `ubuntu-arm`'s native Rust into `wasm`. Pull requests keep the
primary's gate, spread over six jobs, and keep the parallel floor; the ruleset
needs no edit; and on the same measurements the ARM load falls by about a
fifth — but the six toolchain names stay required checks, and every commit
still waits for six runners.

### Tasks

- [ ] Split each tool's steps into version checks and commands, so one job can
      carry them all under one `nixInstall`.
- [ ] Build the primary job on `ubuntu-arm` in the order above, dropping its
      plain `node --test`.
- [ ] Replace `Setup.mergeQueueOnly` with `Setup.mergeQueue`, and declare the
      break: `Setup` loses `mergeQueueOnly`, and the workflow `fjs ci` writes
      loses the `wasm`, `deno`, `bun`, `node22`, `node24` and `node26` jobs, so a
      project that requires any of them as a status check removes it before
      regenerating, in the order the ruleset task gives. Any job-id export that
      no longer names a job goes into the same declaration.
- [ ] Give the primary a run limit of its own; rework the `jobTimeout` proof
      and the comments that say every job takes `jobTimeout`.
- [ ] Move `nixCoverage`'s one-flake-per-job rule to steps.
- [ ] Re-key every proof on a removed job id, the Wasmtime threads guard on the
      wrapped command; update `matrixShape`.
- [ ] Measure the primary's disk use on a trial run.
- [ ] Migrate the ruleset: remove `wasm`, `deno`, `bun`, `node22`, `node24`
      and `node26` from the required checks **before** the switching pull
      request enters the merge queue. In the other order, the queue waits for
      checks nothing reports until its status check timeout ejects every
      entry.
- [ ] Rewrite every document that names a removed job or the per-OS
      `mergeQueueOnly`: the root [AGENTS.md](../../../AGENTS.md) and
      [CONTRIBUTING.md](../../../CONTRIBUTING.md),
      [fjs/AGENTS.md](../../AGENTS.md),
      [the compiler's README](../../compiler/README.md),
      [../README.md](../README.md), [../nix/README.md](../nix/README.md),
      [packed-consumer-validation](../packed-consumer-validation.md), the
      generator's JSDoc that counts or names jobs (`nixJobs`, `canonicalJobs`,
      `../config/module.f.js`), and the `todo/`s that cite them.
- [ ] Rewrite the rules of
      [ci-package-aware-deno-and-bun-steps](./ci-package-aware-deno-and-bun-steps.md)
      for the primary's Deno and Bun steps instead of job keys.

### Related

- [ci-integration-tests](./ci-integration-tests.md) — the same shape with a
  different matrix: its integration stage runs the packed package's scenarios
  per platform and calls per-platform unit tests unimportant. The five jobs
  here run the suite and native Rust, and are where its scenarios would run.
- [built-package-checks](./built-package-checks.md) — the five cross-platform
  jobs are where its per-platform checks would run; its platform-coverage
  question stays open.
- [ci-package-aware-deno-and-bun-steps](./ci-package-aware-deno-and-bun-steps.md)
  — omits the `deno` and `bun` job keys; after this, it omits their steps.
- [migrated-job-proof](./migrated-job-proof.md) — its checks read each tool's
  step list, which survives the split; `installsNixOnly` goes with the
  per-tool `nixInstall`, and the rest apply to the split command lists.
- [ci-generator-audience](./ci-generator-audience.md) — this changes what
  `fjs ci` writes for every project: its job ids, the `Setup` default, and
  which suite a pull request runs.
- [readme-after-shell-consolidation](./readme-after-shell-consolidation.md) —
  rewrites the same `../README.md` sections as the documents task.
- [65z-ci-nix](./65z-ci-nix.md) — its job-count argument for having no `dev`
  job changes: on a pull request only the primary enters the shell.
- [wasmtime-threads-cell-until-47](./wasmtime-threads-cell-until-47.md) —
  decides the threads cell whose guard moves to the primary.
- [096-ci-caching](./096-ci-caching.md) — one runner realizes the shells per
  pull-request commit instead of seven; the merge queue still realizes them
  per job.
- [change-aware-ci](./change-aware-ci.md) — runs only the primary's steps a
  change affects, which is what brings its serial time back down.
