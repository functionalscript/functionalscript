# Smart CI

CI records successful checks in the repository's `build-cache` branch through
[Git CAS](../../cas/git/README.md). A hit skips that check's steps; it does
not restore build outputs. Entries belong to individual checks, so a successful
type check cannot certify a package check or another engine's suite.

The repository's own CI enables the cache. The general workflow generator
leaves it disabled, since its input selectors describe this repository.
The dedicated `cov` job starts unconditionally, then its coverage command
checks [per-target dependency manifests](../../emergent_testing/README.md#testing-and-covering-one-module).
It does not use the whole-check input selectors below.

## Inputs and keys

`npm start ci init` enumerates file IDs from the checked-out commit with one
native `git ls-tree -r -z --full-tree` call, without reading source blobs or
working-tree files. NUL-delimited records preserve literal paths, and Git's hex
object IDs become the same CBase32 identities used by the cache. This avoids
reopening and decoding pack indexes for every source directory. It builds four
input manifests:

| Group | Inputs |
| --- | --- |
| `fjs` | FunctionalScript, generated files, package/task configuration, CLI and test-runner tooling |
| `js` | Other JavaScript, dependency lockfiles, and `spec/`; includes the `fjs` manifest's key |
| `ts` | TypeScript and its configuration; includes the `js` manifest's key |
| `rust` | Workspace crates, Cargo configuration and locks, and shared build tooling |

The selectors also name files excluded from the cache. Every tracked file must
be selected or explicitly excluded, so adding a new kind of input requires a
decision. Groups may overlap: generated Rust belongs to both `fjs` and `rust`.
Markdown and TODO files under shared CI tooling (`fjs/ci/` and
`.github/workflows/`) are excluded. Documents in the Rust workspace and `spec/`
remain inputs because those checks may read them.

Each check hashes its ordered commands and execution settings, platform facts,
and pinned tool versions into a contract. Its entry contains that contract and
its selected input manifest. Canonical JSON uses `stringifySorted`, SHA-256,
and the existing CBase32 CAS keys. Check names alone never establish a hit.

Compile checks use `fjs`; suites and `node26`'s combined coverage use `js`;
TypeScript and the packed-package check use `ts`; Rust checks use `rust`.
The additional isolated `cov` job does not use the whole-check cache.
Generated-file drift checks and the WASM demo rebuild always run because their
complete inputs are not yet enumerated.

## Isolated coverage manifests

`npm start cov node` uses the same Git CAS branch through a separate manifest
contract. Each measured target's manifest contains repository-relative paths
and working-tree SHA-256/CBase32 hashes of every immediate authored sibling and
its transitive static dependencies. It also includes coverage settings and the
actual runtime plus loaded tooling-file closure. Canonical JSON makes the key
deterministic. Local edits, proof inventory changes and tool/runtime changes
invalidate the affected success. The repository root's `package.json` is a
required input; all present ancestor `package.json` files for loaded files
inside the repository are hashed too. New nested package scopes therefore
invalidate the affected manifests. A missing root package file leaves the run
uncached rather than depending on package metadata outside the repository.

Planning uses one runtime probe and one shared dependency graph. Source bytes,
hashes and parsed imports are shared across all targets; framework files use
the same snapshot. Target manifests select their reachable inputs without
rebuilding the graph. Their keys are hashed once, then checked together against
one native Git inventory of `build-cache`; matching blobs are verified in one
batch against the exact prepared manifest contents. Native loader fingerprints
bind framework discovery to the bytes actually loaded; the probe entry is pinned
before startup. An unsupported directory leaves independent directories
eligible for caching.

Cache-only admission refuses dynamic `import`, `import.meta`, `require`,
`eval`/`Function`, and explicit host-global references. These forms continue
through ordinary coverage without cache reuse; no language semantics change.

A directory's coverage process is skipped only when every measured target has
an exact local success. Before using its plan and after successful coverage, the runner
compares relevant input bytes, sibling inventories, package scopes and resolution
identities against the snapshot, without reparsing or rehashing. Changed inputs
run coverage, including a planned cache hit that became stale, and cannot publish
that snapshot's success. During execution there are no cache lookups, key hashes
or cache writes; the runner remembers stable successes for the recording phase.
Framework validation includes original import paths and absent nearer package
scopes, so retargeted symlinks and newly added package boundaries invalidate reuse.
After all modules finish, new successful entries are stored in one native Git
`fast-import` commit. An empty batch writes no commit. Failed coverage contributes
no manifest, while other modules' successes are retained. Incomplete dependency
analysis, unsupported preload settings and cache failures are reported and run
uncached. [Measurement records](../../emergent_testing/cov/measurements.md)
distinguish full planning, reporter startup and earlier preparation-only timings.

With `npm start -- cov node --sync`, the command fetches the remote baseline
at startup and publishes once after module processing and batch recording.
Modules and cache hits do not synchronize individually. The final publication
also retries pending local successes. Concurrent additions are fetched and
replayed on top of the latest remote parent using normal push retries. The
local branch is then refreshed for subsequent runs. Without the flag, only the
local branch is read or updated. The source checkout is untouched.

Native children inherit stdout and stderr for live reporter output, retaining
the existing quiet Node reporter's filtering. Its small admission-check module
does not import the cache or dependency planner. After a child finishes, each
target prints its repository-relative filename followed by `...Ok` or
`...Failed`. Failures also identify the command and directory. Cache hits launch
no child and print only `...Cached` for each target.

The repository's additional `cov` job supplies the bot's author/committer
identity and enables `--sync` only for same-repository runs outside Dependabot.
Forks, Dependabot and generic generated workflows use local caching without
publication. Existing jobs, including `node26`'s combined coverage cache, retain
their current lifecycle.

## Job lifecycle

Each whole-check job fetches only the tip of `build-cache` into the local branch
and `refs/remotes/origin/build-cache`, then initializes the cache before expensive
tool installation. The remote ref preserves the initial publication baseline.
Initialization uses `GITHUB_JOB` to select the checks and platform directly
from the same repository configuration used by the CI generator. It takes no
arguments and needs no custom environment variables or generated settings files.
Initialization writes one hit flag per check to `$GITHUB_OUTPUT` and saves the
original manifests under `$RUNNER_TEMP`.
Checks keep their producer and consumer steps under one gate. A shared install
runs when any dependent check misses.

`npm start ci report <check>` stores the manifest only after that check
succeeds. The workflow supplies the bot's name and email through
`GIT_AUTHOR_NAME` and `GIT_AUTHOR_EMAIL`; the reporter does not resolve identity
through Git config, whose credential includes belong to checkout. A hit writes
nothing. The final `npm start ci publish` step publishes the recorded successes,
even if a later check failed; fork and Dependabot pull requests do not publish.
The workflow also supplies `GIT_COMMITTER_NAME` and `GIT_COMMITTER_EMAIL` to
the publisher for cache publication commits.

Publication compares the committed trees of the local cache branch and that
initial remote ref. An unchanged tree needs no push or temporary worktree,
regardless of differences in commit metadata. A missing local branch means
there is no cache information to publish; a missing baseline permits the first
publication. These decisions use Git refs and trees, without marker files.

When there is new information, publication squashes the job's additions into
one commit whose sole parent is the initial remote tip, or a root commit for
the first publication. It makes at most ten normal push attempts, without force
pushing. After a failed push, it fetches the current `build-cache` tip and
squash-merges it with the local cache branch in a temporary worktree. If the
combined tree matches the latest remote tree, it stops without committing or
pushing. Otherwise it creates a replacement commit with the latest remote tip
as its sole parent and retries. Published history stays intact and linear;
shallow baselines and independently created cache roots are supported.

Git plumbing captures output through an argument-vector subprocess, without a
shell, so Windows and POSIX jobs pass paths and arguments literally.

Fetches and pushes run from the source checkout so Git uses the credentials configured there by
`actions/checkout`. Only the separate worktree checks out the cache branch;
publication leaves the source checkout untouched. Concurrent reports accumulate
without rerunning the checks that produced them.

Cache fetch, initialization, reporting, and publication are best effort.
Initialization failure leaves the checks to run normally and disables
publication. A report failure does not block later checks. The checks themselves
still fail the job on error. Publication stops if fetching or merging fails, or
after ten unsuccessful push attempts. Unpublished entries only cost another run.

The whole-check cache supports only committed CI snapshots; isolated coverage
manifests additionally support local working-tree bytes. The checkout uses LF
line endings;
symlinks, submodules, or unrepresented inputs cannot certify a check. Executable
mode bits are outside the file identities, as in the original cache design. The
platform key is as coarse as the runner label and tool pins: runner patch
levels and the image's unpinned SDKs are deliberately outside it. Entries are
trusted claims by whoever can push to `build-cache`.

## Cleanup and extensions

To invalidate entries, check out `build-cache` in a separate worktree, delete
the relevant `.cas/` paths, commit, and push. Removing every `.cas/` entry
forces all cached checks to run again. Git's storage reclamation is separate.

To add a finer check, declare all of its inputs and its ordered steps, including
the setup those steps depend on. Give it its own contract and report only
after the whole check succeeds. Overlapping input sets are supported; build
outputs consumed by an uncached step must still be produced in that run.

[Follow-up work](../todo/smart-ci-follow-ups.md) covers local execution,
generator input selection, and improvements justified by measurements.
