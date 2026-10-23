# Smart CI

CI records successful checks in the repository's `build-cache` branch through
[Git CAS](../../cas/git/README.md). A hit skips that check's steps; it does
not restore build outputs. Entries belong to individual checks, so a successful
type check cannot certify a package check or another engine's suite.

The repository's own CI enables the cache. The general workflow generator
leaves it disabled, since its input selectors describe this repository.

## Inputs and keys

`npm start ci init` reads file IDs from the checked-out commit's Git trees,
without reading source blobs. It builds four input manifests:

| Group | Inputs |
| --- | --- |
| `fjs` | FunctionalScript, generated files, package/task configuration, CLI and test-runner tooling |
| `js` | Other JavaScript, dependency lockfiles, and `spec/`; includes the `fjs` manifest's key |
| `ts` | TypeScript and its configuration; includes the `js` manifest's key |
| `rust` | Workspace crates, Cargo configuration and locks, and shared build tooling |

The selectors also name files excluded from the cache. Every tracked file must
be selected or explicitly excluded, so adding a new kind of input requires a
decision. Groups may overlap: generated Rust belongs to both `fjs` and `rust`.

Each check hashes its ordered commands and execution settings, platform facts,
and pinned tool versions into a contract. Its entry contains that contract and
its selected input manifest. Canonical JSON uses `stringifySorted`, SHA-256,
and the existing CBase32 CAS keys. Check names alone never establish a hit.

Compile checks use `fjs`; suites and coverage use `js`; TypeScript and the
packed-package check use `ts`; Rust checks use `rust`. Coverage still loads
plain JavaScript proofs, so it must use `js`. Generated-file drift checks and
the WASM demo rebuild always run because their complete inputs are not yet
enumerated.

## Job lifecycle

Each job fetches only the tip of `build-cache` into the local cache branch and
`refs/remotes/origin/build-cache`, then initializes the cache before expensive
tool installation. The remote ref preserves the initial publication baseline.
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
the publisher for Git merge commits.

Publication compares the committed trees of the local cache branch and that
initial remote ref. An unchanged tree needs no push or temporary worktree,
regardless of differences in commit metadata. A missing local branch means
there is no cache information to publish; a missing baseline permits the first
publication. These decisions use Git refs and trees, without marker files.

When there is new information, publication makes at most ten total push
attempts. After a failed push, it fetches the current `build-cache` tip and
merges it with the local cache branch in a temporary worktree. It compares the
merged tree with the latest remote tree before retrying: if they match, it
stops without pushing a metadata-only change. Fetches and pushes run from the
source checkout so Git uses the credentials configured there by
`actions/checkout`. Only the separate worktree checks out the cache branch;
publication leaves the source checkout untouched. Concurrent reports accumulate
without rerunning the checks that produced them.

Cache fetch, initialization, reporting, and publication are best effort.
Initialization failure leaves the checks to run normally and disables
publication. A report failure does not block later checks. The checks themselves
still fail the job on error. Publication stops if fetching or merging fails, or
after ten unsuccessful push attempts. Unpublished entries only cost another run.

Only committed CI snapshots are supported. The checkout uses LF line endings;
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
