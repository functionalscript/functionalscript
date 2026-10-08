## Run only what a change affects

**Priority:** P3
**Status:** open

### Problem

Every pull-request commit runs every check of its jobs, whatever it changed. A
change to Rust alone still runs the Node, Deno and Bun suites; a change to
FunctionalScript alone still builds and tests every Linux and WASM Rust target;
a change to a `todo/` file runs both.

Measured over the CI runs of 2026-10-08, with `main` between `0b5f6fdf4` and
`bb2648dbb` — most of them before `f7b42b9de` (#2688) held macOS and Windows to
the merge queue, so the totals below count only the Linux and WASM jobs — the
seven JavaScript suite runs of a pull-request commit took about 20
runner-minutes and its Linux and WASM `cargo` steps about 3.5. Most of a
commit's work is a mismatch for most changes. In separate jobs the waste is
runner-minutes; folded into one serial job ([six-ci-jobs](./six-ci-jobs.md)), it
is the pull request's wait.

### Proposal

Classify the paths a pull request changes into **areas**, and run each check
only when an area it depends on changed. Pull-request commits are where this
applies; **the merge queue runs everything**. The queue is the gate on what
reaches `main`, so a classification that misses a dependency costs a
merge-queue eviction rather than a broken `main` — for every change that goes
through the queue. An admin bypass of the `main` ruleset would merge after only
the classified checks ran, so the bypass narrows to the queue or is removed.

#### Areas

| Area | Paths | Runs |
|------|-------|------|
| Rust | everything under a crate directory (`nanvm-lib/`, `nanvm-harness/`, `nanvm-effects-node/`), the root `Cargo.toml` and `Cargo.lock`, `.cargo/` | `cargo fmt`, Clippy, native and WASM tests, the drift check |
| JavaScript and FunctionalScript | what the suite loads (`shouldLoad` in `fjs/dev/module.f.mjs`), `package.json`, `package-lock.json`, `tsconfig.json`, the Deno and Bun manifests and lockfiles | `tsc`, `npm start compile`, the Node, Deno and Bun suites, the packed-package check, the drift check |
| Generated | any path with a segment `isGenerated` (`fjs/dev/clean/module.f.mjs`) holds for | the drift check |
| Documents | markdown outside the crate directories and outside generated paths | nothing |
| Everything | `gen.nix/`, `fjs/ci/`, `.github/`, `.gitignore`, `.gitattributes`, the classifier's own imports, and any path no rule names | every check |

A path's areas are the **union** of every row it matches: `gen.methods.rs` is
both Rust and Generated. JavaScript and FunctionalScript are one area because
every check in that row reads both kinds of file. The classifier imports
`shouldLoad` and `isGenerated` rather than restating their patterns.

What puts a path in an area is what a check *reads*, not the file's extension:

- **Rust reads a little markdown and no JavaScript.** `nanvm-lib`'s
  `vm/unstable` module compiles its `README.md` in with `include_str!`, and its
  code blocks run as doctests, which is why the Rust area is whole crate
  directories rather than `*.rs`. FunctionalScript reaches Rust only through
  committed, generated files — such as `nanvm-lib`'s `gen.methods.rs` and
  `tests/test/gen.corpus/`, `nanvm-harness`'s `gen.fixtures` and `gen.values`,
  and `nanvm-effects-node`'s `gen.commands.rs` — so a JavaScript change that
  alters Rust commits the regenerated files, which are themselves Rust and
  Generated changes, and one that forgets is caught by the drift check.
- **No check reads the other markdown.** No proof reads repository markdown at
  run time, and the website build, which reads `todo/`, runs outside GitHub
  Actions. A document a check is ever found to read moves to that check's area.
- **The drift check is more than `npm run gen`.** Its `git diff --cached` judges
  what every earlier step wrote to the tree, `cargo` included, and its
  generators read FunctionalScript and whether `Cargo.toml` exists — so it runs
  for every area but Documents.
- **Unknown means everything.** A path no rule names runs every check; a rule
  only ever removes work it can show is unaffected.

#### Mechanics

- **Gate whole checks, not single steps.** Several checks are a producer step
  and a consumer step, and gating them apart lets the consumer pass on nothing:
  skip `npm run gen` and the drift check's `git diff` compares the committed
  files with themselves; skip the step that writes `bad.mts` and the
  negative type check, `! npx tsc … bad.mts`, passes because `tsc` fails on a
  missing file. Each install with its suite, the drift check's two steps, and
  the packed-package check's steps from `npm pack` on share one gate.
- **Gates default to running.** A gate reads
  `if: github.event_name != 'pull_request' || steps.<id>.outputs.<area> != 'false'`,
  so a check runs unless the classifier said `false`. The merge queue, and
  `gen.npm-publish.yml`'s `push`, which run no classifier, run everything, and so
  does a pull request whose classifier wrote nothing.
- **Skip steps, never the workflow.** A workflow-level `paths:` filter leaves a
  required check unreported, which blocks the pull request forever. A skipped
  step leaves its job reporting, and a job skipped by a job-level `if` reports
  as passed.
- **Each job classifies for itself.** A separate classifier job would put a
  `needs` edge in front of every job, and a job behind `needs` is created only
  when the job it waits for finishes — behind a full queue it waits twice (see
  `jobNeeds` in `../proof.f.mjs`). Classifying is cheap enough to repeat.
- **The change is the merge commit against its first parent.** On
  `pull_request` the checkout is the pull request's merge commit, whose first
  parent is the base branch, so `HEAD^1..HEAD` covers every commit of the pull
  request. That needs a checkout two commits deep, and `toSteps` checks out one.
- **Renames count twice.** A moved file is a change at both its old and its new
  path: moving a `.rs` module out of a crate breaks the crate. `git diff`
  detects renames by default and `--name-only` then prints only the new path,
  so the command is `git diff --no-renames --name-only HEAD^1 HEAD`.
- **The classification is FunctionalScript.** It is business logic, so it is a
  module with a proof (root `AGENTS.md` §3); the step that writes its answer to
  `$GITHUB_OUTPUT` is the thin effectful edge. The paths come from either
  `git diff` — an external command in a generated step, which needs approval
  (root `AGENTS.md` §6), and takes two steps, since a pipe would bundle two
  commands into one (§7) — or FunctionalScript reading both commits through
  `fjs/git`, in one step. Prefer the first: the classifier runs from the pull
  request's own tree, so everything it imports is in the Everything area, and
  `fjs/git` would put a large part of the repository there.
- **Steps need `id` and `if`.** `stepSchema` in `../common/module.f.mjs` is
  closed and models neither; the classifier step needs an `id`, and each gated
  step an `if` reading its outputs. [six-ci-jobs](./six-ci-jobs.md) orders its
  primary job around the same missing `if`; a gate without a status function
  keeps the implicit `success()`, so a failure still stops the job.
- **Other projects.** The areas above name this repository's crates and
  generators. For a project using `fjs ci`, the rules come from the project —
  its Cargo workspace members, its generated-file rule — or the feature is
  opt-in through `Setup`; decide which before `fjs ci` emits a gate.

### Tasks

- [ ] Write the classification as a FunctionalScript module with a proof:
      changed paths in, areas out, the union of every matching row, unknown
      paths mapping to everything. Import `shouldLoad` and `isGenerated`.
      Cover `nanvm-lib/tests/test/gen.corpus/mod.rs` (Rust and Generated), a
      rename out of a crate, and a `todo/`-only change (nothing).
- [ ] Derive each area's non-obvious inputs from what the checks read: Rust's
      from `include_str!`, `include_bytes!`, `#[path]` and any `build.rs`; the
      suites' from every proof that reads a file.
- [ ] Choose how the changed paths are read, and get approval if it is an
      external command.
- [ ] Model `id` and `if` on steps in `stepSchema`.
- [ ] Check out two commits deep in jobs that classify, through
      `uses('actions/checkout', { 'fetch-depth': '2' })` in `toSteps`, with a
      proof that every classifying job does.
- [ ] Gate each check — producer and consumer steps together — on its areas,
      with the default-to-run condition above.
- [ ] Prove that every step is gated by a check's areas or runs
      unconditionally, that a step's gate includes the gates of every later
      step that reads its output, and that `gen.npm-publish.yml` carries no
      gate.
- [ ] Narrow the `main` ruleset's bypass to the merge queue, or remove it.
- [ ] Decide how `fjs ci` offers this to other projects.

### Related

- [six-ci-jobs](./six-ci-jobs.md) — folds the toolchain jobs into one serial
  job, whose length this brings back down; this works with today's layout too.
- [097-smart-ca-ci](./097-smart-ca-ci.md) — a title with no body; if "CA"
  means content-addressed, skipping a check whose inputs were already tested at
  the same content hash is the finer form of this.
- [096-ci-caching](./096-ci-caching.md) — caching makes the checks that do run
  cheaper; this runs fewer of them.
