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

- **The ARM Linux runners are our own backlog.** Seven of the eight jobs run on
  `ubuntu-26.04-arm`. When their waits were longest, dozens of this
  repository's own ARM jobs were queued ahead of them while only a handful
  ran — so a pull request waits for the slowest of seven runner assignments,
  not for its work.
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
   `windows-intel`, `windows-arm` — run in the merge queue only, and check
   that FunctionalScript works on each platform: the suite, and each
   platform's native Rust, which is the one part of the repository whose
   behaviour depends on the target. `ubuntu-intel` keeps the 32-bit Linux
   checks, which only the `x86_64-linux` shell can carry.

The job keeps the name `ubuntu-arm` so the ruleset gains no new name, and the
primary keeps the toolchain set a pull request is gated on today.

#### Measured cost

Measured over the CI runs of 2026-10-08, with `main` at `bb2648dbb`:

- The primary job runs serially for about 21 minutes. Today's critical path,
  `node26`, is about 6.5, so feedback with idle runners is about three times
  slower. Under that day's congestion the median pull request would finish
  sooner than today — about 36 minutes against 45 — if its one runner wait is
  as short as today's first ARM job's; as long as a typical ARM job's, it is no
  better. What it saves is waiting for seven runners rather than one.
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
  check has confirmed yet otherwise. `tsc` comes before `npm pack`, whose `prepack` writes declarations
  beside the sources. `npm pack` packs files matching `files` even when they
  are ignored, so it runs before any non-Node step can write into the
  checkout. The drift check comes after every step that writes to the tree.
  `setup-node` and the packed-package check stay last, because `setup-node`
  changes `PATH` for every step after it, and `nodeExtra`'s injected steps
  land before them.
- **One Nix installer.** Each tool's steps (`rustWasmSteps`, `denoSteps`,
  `bunSteps`, `suiteNixSteps`, `node26Steps`, `shellPlatformSteps`) carry
  their own `nixInstall`, and `toSteps` does not merge duplicates. They have to
  split into version checks and commands before one job can carry them all.
- **Several flakes in one job.** The primary enters the shared shell and the
  Node 22 and Node 24 flakes, a step at a time. `nixCoverage` asserts one
  flake per job, and each of those two flakes takes its id from the job that
  enters it; both rules move from jobs to steps.
- **Failures stop the job.** The first red step skips everything after it, and
  `stepSchema` models no step-level `if`. Order the fast gates first — `cargo
  fmt`, `tsc`, `npm start compile`, the drift check — so the common failures
  show early.
- **The run limit.** `jobTimeout` in `../config/module.f.js` is 15 minutes,
  under the primary's serial time. The primary needs a limit of its own; the
  other jobs keep theirs, so a hung shell build still frees its runner.
- **`mergeQueueOnly` is per OS.** It cannot hold `ubuntu-intel` to the queue
  while `ubuntu-arm` runs on pull requests. The split becomes the shape of the
  workflow rather than a list: the primary always runs, and the five run in
  the merge queue when the project has one. A breaking change to `Setup`, to
  declare.
- **Proofs keyed on job ids.** `matrixShape` counts twelve jobs. Assertions
  that a removed job does *not* run something — the Wasmtime threads guard on
  `wasm`, the `node22` published-CLI guard, the `npm ci` guards on `deno` and
  `bun` — would pass because the job is gone, so they move to the primary
  rather than being deleted with it.
- **Disk.** One `ubuntu-arm` runner holds every toolchain closure, the
  `target/` directory for native and every WASM target, and the dependency
  installs of three package managers. Measure it on a trial run first.
- **32-bit checks on pull requests.** With `ubuntu-intel` queue-only, no
  pull-request commit runs the 32-bit Linux checks; a 32-bit failure shows
  only as a merge-queue eviction. WASM still checks a 32-bit pointer width on
  every commit.

#### Alternative

Hold all six platform jobs to the merge queue and keep the toolchain jobs
parallel, moving `ubuntu-arm`'s native Rust into `wasm`. Pull requests keep the
same gate and today's parallel floor, the ruleset needs no edit, and the ARM
load falls by about a fifth — but the six toolchain names stay required checks,
and every commit still waits for six runners.

### Tasks

- [ ] Split each tool's steps into version checks and commands, so one job can
      carry them all under one `nixInstall`.
- [ ] Build the primary job on `ubuntu-arm` in the order above, dropping its
      plain `node --test`.
- [ ] Replace `Setup.mergeQueueOnly` with the primary/cross-platform split;
      declare the break.
- [ ] Give the primary job a run limit that fits it.
- [ ] Move `nixCoverage`'s one-flake-per-job rule to steps.
- [ ] Re-key every proof on a removed job id; update `matrixShape`.
- [ ] Measure the primary's disk use on a trial run.
- [ ] Migrate the ruleset: remove `wasm`, `deno`, `bun`, `node22`, `node24`
      and `node26` from the required checks **before** the switching pull
      request enters the merge queue. In the other order, the queue waits for
      checks nothing reports until its status check timeout ejects every
      entry.
- [ ] Rewrite the documents that name the current jobs: `../README.md`,
      `../nix/README.md`, and the job descriptions in `AGENTS.md` and
      `CONTRIBUTING.md`.

### Related

- [ci-integration-tests](./ci-integration-tests.md) — the same split: one
  platform-agnostic build job and a platform matrix.
- [built-package-checks](./built-package-checks.md) — its platform-coverage
  question is answered here; the Windows jobs still run a published
  FunctionalScript rather than this commit.
- [ci-package-aware-deno-and-bun-steps](./ci-package-aware-deno-and-bun-steps.md)
  — omits the `deno` and `bun` job keys; after this, it omits their steps.
- [migrated-job-proof](./migrated-job-proof.md) — its job-level form of "this
  job migrated onto the shared shell" has no jobs left to describe.
- [096-ci-caching](./096-ci-caching.md) — one shell realization per commit
  instead of one per job.
