## Run only what a change affects

**Priority:** P3
**Status:** open

### Problem

Every pull-request commit runs every check, whatever it changed. A change to
Rust alone still runs the Node, Deno and Bun suites; a change to FunctionalScript
alone still builds and tests every Rust target; a change to a `todo/` file runs
both. Measured over the CI runs of 2026-10-08, with `main` between `0b5f6fdf4`
and `bb2648dbb`, the five JavaScript suites took about 16 runner-minutes of a
pull-request commit and the native and WASM Rust checks about 2.5, so the
mismatch is most of a commit's work. In separate jobs the waste is
runner-minutes; folded into one serial job ([six-ci-jobs](./six-ci-jobs.md)), it
is the pull request's wait.

### Proposal

Classify the paths a pull request changes into **areas**, and run each step of
a job only when an area it depends on changed. Pull-request commits are where
this applies; **the merge queue runs everything**. The queue is the gate on what
reaches `main`, so a classification that misses a dependency costs a
merge-queue eviction, never a broken `main` — which is what makes it safe to
start with a simple classification and refine it.

#### Areas

A first cut, by what each check reads:

| Area | Paths | Runs |
|------|-------|------|
| Rust | `*.rs`, `Cargo.toml`, `Cargo.lock`, `.cargo/` | `cargo fmt`, Clippy, native and WASM tests |
| JavaScript | `*.mjs`, `*.js`, `*.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, the Deno and Bun manifests and lockfiles | `tsc`, `npm start compile`, the Node, Deno and Bun suites, the packed-package check |
| Documents the suite reads | markdown that a proof reads, such as `todo/`'s | the Node suite |
| Generated | `gen.*` | the drift check |
| Everything | `gen.nix/`, `fjs/ci/`, `.github/`, and any path no rule names | every step |

What decides an area is what a check *reads*, not a file's language:

- **Rust reads no JavaScript at run time.** FunctionalScript reaches Rust only
  through committed, generated files — `gen.methods.rs` from
  `fjs/nanvm/methods`, `nanvm-harness`'s `gen.fixtures` and `gen.values`,
  `nanvm-effects-node`'s `gen.commands.rs` — so a JavaScript change that
  alters Rust must commit the regenerated `.rs`, which is itself a Rust change,
  and one that forgets is caught by the drift check.
- **The drift check runs `npm run gen`**, whose generators read
  FunctionalScript, so it runs for a JavaScript change as well as for a change
  to a `gen.*` file.
- **Unknown means everything.** A path no rule names runs every step; a rule
  only ever removes work it can prove is unaffected.

#### Mechanics

- **Skip steps, never the workflow.** A workflow-level `paths:` filter leaves a
  required check unreported, which blocks the pull request forever. A skipped
  step leaves its job reporting, and a job skipped by a job-level `if` reports
  as passed.
- **Each job classifies for itself.** A separate classifier job would put a
  `needs` edge in front of every job, and a job behind `needs` is created only
  when the job it waits for finishes — behind a full queue it waits twice (see
  `jobNeeds` in `../proof.f.mjs`). Classifying is cheap enough to repeat.
- **The diff of a pull-request commit is one commit's.** On `pull_request`,
  the checkout is the pull request's merge commit, whose first parent is the
  base branch, so `HEAD^1..HEAD` is exactly the change being tested, with a
  checkout two commits deep. In the merge queue there is nothing to compute.
- **The classification is FunctionalScript.** It is business logic, so it is a
  module with a proof (root `AGENTS.md` §3); the step that hands it the changed
  paths and writes its answer to `$GITHUB_OUTPUT` is the thin effectful edge.
  Getting the paths is either `git diff --name-only` — an external command in a
  generated step, which needs approval (root `AGENTS.md` §6) — or
  FunctionalScript reading both commits through `fjs/git`.
- **Steps need `id` and `if`.** `stepSchema` in `../common/module.f.mjs` is
  closed and models neither; the classifier step needs an `id`, and each
  gated step an `if` reading its outputs. [six-ci-jobs](./six-ci-jobs.md)
  wants a step-level `if` for its own reasons.

### Tasks

- [ ] Write the classification as a FunctionalScript module with a proof:
      changed paths in, areas out, unknown paths mapping to everything.
- [ ] Derive the "documents the suite reads" rule from the proofs that read
      files, rather than guessing it.
- [ ] Choose how the changed paths are read, and get approval if it is an
      external command.
- [ ] Model `id` and `if` on steps in `stepSchema`.
- [ ] Gate each generated step on its areas on `pull_request`, and on nothing
      in `merge_group`.
- [ ] Prove that every step is gated by some area or runs unconditionally, so
      a new step cannot be skipped by omission.

### Related

- [six-ci-jobs](./six-ci-jobs.md) — folds the toolchain jobs into one serial
  job, whose length this brings back down; it works with today's layout too.
- [097-smart-ca-ci](./097-smart-ca-ci.md) — names the idea with no body yet;
  skipping a check whose inputs were already tested at the same content hash
  is the finer form of this.
- [096-ci-caching](./096-ci-caching.md) — caching makes the steps that do run
  cheaper; this runs fewer of them.
