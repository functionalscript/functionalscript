## Prove each module's coverage by its own proof

**Priority:** P2
**Status:** wip

### Problem

The former `npm run cov` script ran every proof at once and then checked coverage.
A module passed when *any* proof reached its code, not when its own proof did, which is
what [`fjs/AGENTS.md`](../../AGENTS.md#12-proof-coverage-is-mandatory)
requires. At `78c51a1d`, `fjs/types/list/module.f.mjs` passes, but its own
proof leaves a branch of `lengthList` unreached.

It was also slow: at `78c51a1d`, on a four-core machine with Node 22, about six
minutes for the whole suite, so it ran only in CI. One module under coverage took
about half a second.

### Proposal

Use a runner that discovers modules and executes their coverage commands
directly. The unit of proof ownership is one directory: its own proofs must
cover each measured file immediately inside it. Keep the existing measured
set: `module.f.mjs`, `module.f.js` and `demo.f.mjs`. Helpers, examples and
fixtures under other filenames do not acquire a new coverage obligation.

#### Single-directory entry

`fjs/emergent_testing/one.mjs` registers the proofs in the actual working
directory, and nothing below it, with the native runner that imports it:

```sh
cd fjs/types/list
node --test ../../emergent_testing/one.mjs
```

Load all immediate authored FunctionalScript files (`.f.mjs` and `.f.js`)
and register their exported `proof` values. This includes `proof.f.mjs`,
split `*.proof.f.mjs` files and inline proofs. Implementation and demo proofs
already share a directory, so they belong to the same suite. Imported
dependencies may execute, but their proofs are not automatically registered.
Host-JavaScript proofs stay in their existing separate suite.

Reuse the existing proof registration and native adapters, preserving their
handling of expected throws and returned proof trees. Keep `one.mjs` thin;
shared discovery and registration logic belongs in FunctionalScript.

Discovery must be shallow, not a recursive walk followed by filtering.
Select the actual working directory even when npm's inherited `INIT_CWD`
names another directory. No directory argument or custom environment variable
is needed. In particular, `node --test one.mjs -- directory` does not forward
the directory to the entry: Node interprets trailing paths as test inputs.

The entry's name matches neither native default test discovery nor
`shouldLoad`, so it runs only when explicitly selected. A directory without
any runnable proof leaves is an error. Without coverage flags the entry only
tests; with them it also supplies the proofs for that directory's coverage.

#### Coverage runner

`fjs cov node`, also available as `npm start cov node`, discovers measured
source files under the caller's directory using the existing source traversal
rules. Honor npm's original invocation directory when selecting this subtree.
Discover targets independently of proofs so missing proofs cannot hide a
module. Group the targets by directory, in deterministic path order; an empty
target inventory or failed discovery is an error.

For each directory, start a fresh native Node test process with that
directory as its working directory and `one.mjs` as its explicit entry. Limit
coverage to that directory's measured files, with 100% line, branch and
function thresholds. Each other discovered directory is checked in its own
run; imports do not expand the selected subtree. Coverage data from other
directories, previous runs or the ordinary full test suite must never
contribute to this result.

Prepare every directory's manifest and complete one cache lookup before any
coverage child starts. Execute the planned jobs in batches bounded by Node's
`os.availableParallelism()`: children in a batch run concurrently, then the next
batch starts after every job in the current batch settles. Scheduling capacity
is not part of the cache key. Continue after a module fails, retaining stable
successes for one final save/sync after all batches, then exit nonzero if any
module failed.

#### Reporting

Print a complete `path: running` line for each measured file by
repository-relative path before starting its child. Files in one directory
share a child and duration, but each gets its own complete result line using
emergent testing's shared status and timing formatter. Capture child stdout and stderr, keeping
successful output hidden. Write a failed result and its working directory,
complete invocation, exit status or signal, and stdout/stderr together so
concurrent children cannot splice their output into the block. Replay stdout
followed by stderr. Grouping the two streams does not preserve their original
ordering relative to each other.
Report launch/capture errors directly. Cache hits launch no child and print no
per-file result. Continue after failures and finish with coverage totals,
including the cached module count.
Execute with a structured argument vector, without a shell.

The command currently accepts `--sync` for end-of-run cache publication.
`--quiet` and `--verbose` remain future reporting work, not implemented flags.
Any future verbosity controls must preserve proof selection, strict coverage
requirements and exit status.

#### Coverage contract

Each measured file must independently reach 100% across Node's native
metrics: lines, branches and functions. Check unrounded counts, not a
displayed percentage that rounds to `100`. A present file with no applicable
items for a metric may report that metric as N/A; a missing file cannot pass
that way. A separate statements metric is not part of Node's native report.

Passing requires successful proof execution and valid coverage for every
expected target. Failed imports or tests, no runnable proofs, a crashed or
timed-out child, missing or malformed coverage, and missing target files all
fail the module. Validate structured coverage data rather than parsing the
formatted report. Fix the proofs or implementation the switch exposes instead
of lowering thresholds or allowing exceptions.

Dependency-analysis or manifest-admission failures also fail the command,
even when the affected native proofs pass. Report `CACHE ADMISSION`, continue
running proofs and independent directories, and retain their stable successes.
Ordinary cold-cache misses run and populate the cache. Cache storage outages
remain an explicit uncached fallback.

#### CI and scope

CI's dedicated `cov` job invokes `npm start cov node` directly from the
repository root. The `node` job runs `npm start t` with the built-in reporter
without coverage, retaining the full authored FJS suite: proof-only integration
directories, fixture imports and module-level assertions. Its whole-check cache
records a `suite` result; coverage remains the dedicated job's responsibility.

Node is the initial coverage authority. Deno and Bun coverage support is
deferred; their existing test runs remain. Future coverage adapters must say
which metrics they enforce and must not silently claim the Node contract
when a required metric is unavailable.

### Acceptance criteria

- Another directory's proofs can bring the combined suite to 100%, but a
  module whose own suite misses a branch still fails.
- Split sibling proofs and inline proofs run; descendant proofs do not.
- An inherited `INIT_CWD` cannot change a child's selected directory.
- Every expected measured file appears in coverage, including a file its
  proofs never import. A missing report or file fails.
- A rounded `100%` with an uncovered item fails, and complete coverage cannot
  turn a failed or empty test run into a pass.
- Previous runs and other modules cannot supply coverage for a module.
- Progress names the measured files in a complete start line before launch,
  then prints a separate complete result line with status and timing. Successful
  child output is suppressed; failures name
  their working directory and full reproducible command, with paths and
  arguments quoted unambiguously, then print captured stdout and stderr.
  Cache hits print no per-file result and contribute to the final cached count.
- Future verbosity controls change presentation only; they must not change
  discovery, coverage requirements or exit status.
- Module failures do not stop the remaining checks; any failure makes the
  final exit status nonzero.
- Concurrent coverage children never exceed the host's available parallelism.
  All manifests and the one cache lookup precede execution; successful entries
  are saved once, with synchronization when requested, after all batches finish.
- Failed source admission cannot become a successful command through passing
  native proofs, while ordinary cache misses remain successful.
- The ordinary FJS suite retains proofs outside measured module directories.

### Tasks

- [x] Add shallow proof discovery and `one.mjs`, reusing native registration.
- [x] Add `fjs cov node` with isolated runs, strict coverage
      validation, failure diagnostics and shared emergent-testing progress.
- [x] Name measured files in complete start/result lines while hiding successful
      child output and grouping failure diagnostics.
- [x] Run coverage children concurrently in batches bounded by available
      parallelism, preserving one planning barrier and one final cache batch.
- [ ] Consider explicit quiet/verbose controls and additional failure diagnostics;
      neither flag is currently implemented.
- [x] Add regression proofs for the isolation, discovery, coverage and
      reporting contracts above.
- [x] Fix the exposed gaps in modules' own proofs or implementations.
- [x] Add a CI job invoking `npm start cov node` without changing the existing
      jobs; update contributor and runner documentation.
- [x] Replace `node26`'s combined coverage check with `npm start t`, retaining
      the full authored FJS test pass alongside the dedicated coverage job.
- [ ] Add `fjs cov deno`, with per-module isolation and explicit
      coverage-metric enforcement.
- [ ] Add `fjs cov bun`, with per-module isolation and explicit
      coverage-metric enforcement.

### Related

- [Cache coverage by module dependencies](../../ci/cache/README.md#isolated-coverage-manifests)
  — dependency manifests and successful-result reuse; this issue
  retains ownership of proof isolation and the gaps exposed by its rollout
- [run-subset-of-tests](./run-subset-of-tests.md) — general test selection
- [coverage-over-fjs-only](./coverage-over-fjs-only.md) — proof discovery and
  the existing measured source set
- [six-ci-jobs](../../ci/todo/six-ci-jobs.md) — Node's coverage gate and the
  other runtime test suites
