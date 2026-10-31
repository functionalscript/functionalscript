## Prove each module's coverage by its own proof

**Priority:** P2
**Status:** wip

### Problem

`npm run cov` runs every proof at once and then checks coverage. A module
passes when *any* proof reaches its code, not when its own proof does, which is
what [`fjs/AGENTS.md`](../../AGENTS.md#12-proof-coverage-is-mandatory)
requires. At `78c51a1d`, `fjs/types/list/module.f.mjs` passes, but its own
proof leaves a branch of `lengthList` unreached.

It is also slow: at `78c51a1d`, on a four-core machine with Node 22, about six
minutes for the whole suite, so only CI runs it. One module under coverage took
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

Execute directories sequentially in the initial implementation. Continue
after a module fails, then exit nonzero if any module failed. Parallel
scheduling is separate work if measurements justify it.

#### Reporting

**Print each command before executing it by default.** Show the working
directory, the executable and every argument, including the entry path,
coverage filters and thresholds. Quote paths and arguments unambiguously so a
reader can reproduce the invocation. Execute with a structured argument
vector, without a shell; the displayed command is a rendering of that
invocation, not shell code the runner evaluates.

`fjs cov node` accepts mutually exclusive `--quiet` and `--verbose` flags.
With npm, use `--` to forward options, for example
`npm start -- cov node --verbose`. Reject a request that supplies both flags.

- **Default:** print each command before launch, including successful runs,
  then each module's result and per-file coverage, and a final summary.
  Retain failure diagnostics and uncovered locations while suppressing the
  native runner's routine passing-test output.
- **`--quiet`:** suppress successful module results and routine command
  logging. Print failures and the final summary; every failure still names
  its working directory and complete command, with diagnostics and uncovered
  locations where available.
- **`--verbose`:** print each command before launch and retain the full native
  test and coverage output, including passing tests, as well as module results
  and the final summary.

These flags change presentation only: discovery, proof execution, coverage
requirements and exit status are identical in every mode.

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

#### CI and scope

Make `npm run cov` delegate to `fjs cov node`; CI invokes it from the
repository root. Retain one ordinary full native FJS test run without
coverage, through `fjs/emergent_testing/fjs-only.mjs`, so proof-only
integration directories, fixture imports and module-level assertions still
run. That run does not contribute coverage to the isolated checks.

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
- Default and verbose output name the working directory and complete command
  before each launch, with spaces in paths and arguments represented
  unambiguously. Quiet output suppresses routine commands but retains the
  working directory and command for every failure.
- Quiet and verbose modes change output only; supplying both flags is an
  error.
- Module failures do not stop the remaining checks; any failure makes the
  final exit status nonzero.
- The ordinary FJS suite retains proofs outside measured module directories.

### Tasks

- [ ] Add shallow proof discovery and `one.mjs`, reusing native registration.
- [ ] Add `fjs cov node` with isolated sequential runs, strict coverage
      validation, command logging, module results and quiet/verbose modes.
- [ ] Add regression proofs for the isolation, discovery, coverage and
      reporting contracts above.
- [ ] Fix the exposed gaps in modules' own proofs or implementations.
- [ ] Wire `npm run cov` and CI to the runner, retaining the full native FJS
      test pass without coverage; update contributor and runner documentation.

### Related

- [run-subset-of-tests](./run-subset-of-tests.md) — general test selection
- [coverage-over-fjs-only](./coverage-over-fjs-only.md) — proof discovery and
  the existing measured source set
- [six-ci-jobs](../../ci/todo/six-ci-jobs.md) — Node's coverage gate and the
  other runtime test suites
