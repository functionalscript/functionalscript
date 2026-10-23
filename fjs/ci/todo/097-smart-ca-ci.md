## Cache successful builds by their inputs

**Priority:** P3
**Status:** open

### Problem

CI repeats work when the relevant build inputs have already passed, including
when the same inputs appear in another commit or a merge-queue entry. Record
successful input sets so GitHub CI and other build systems can reuse the
result.

### Proposal

Implement this in two stages:

1. Add [CAS support for a non-current Git branch](../../cas/git/README.md),
   including CLI access — done, as `fjs/cas/git` and `fjs cas git`.
2. Use that CAS backend to create and read the `build-cache` branch in the
   same repository and publish complete JSON manifests after build success.

The CAS backend owns branch access and the commit each `add` makes; it
does not sync, publish, retry or delete — `git push`, `git fetch`,
`git merge` and a deletion commit are Git's own, and the jobs run them.
This consumer owns input selection, build identity, the success
condition, and the publication below. Use CAS hashes for the JSON
documents and reuse Git blob IDs for committed source files. The first
target is CI; a developer machine is one more job
([`fjs ci run`](#fjs-ci-run-later), later), which is what the smart-builds
[investigation](../../dev/todo/smart-builds.md) was waiting for.

Two input manifests at first — one for Rust, one for JavaScript and
FunctionalScript — and one entry per CI job: an entry is a manifest whose
contract is one job's, so a job that passed is recorded whether or not a
sibling failed. Finer, possibly overlapping blocks come later, in the same
format and through the same publication.

#### Manifest format

```ts
type CasHash = string // Full CAS key encoded with existing CBase32
type GitBlobHash = string // Full Git blob ID encoded with existing CBase32

type Tree = {
    readonly [name: string]: Tree | GitBlobHash
}

type Manifest = {
    readonly contract: CasHash
    readonly files: Tree
    readonly below?: CasHash // the key of the manifest of the group below
}
```

The `files` root is relative to the repository root. Each key is one path
component; an object represents a directory, and a string is the Git blob ID
recorded for the selected file in the commit being built. Read these IDs
from that commit's trees without reading and rehashing the source blobs.
Reuse [Git tree lookup](../../git/walk/module.f.mjs); its `tryEntry` returns
an entry without reading the entry's blob. These file IDs are input
fingerprints, not keys for reading source files through CAS.

Include every input the block depends on, including relevant build scripts,
configuration, dependency lockfiles, toolchain pins, generator inputs, and
test data. Select by dependency, not filename extension.

`contract` is the CAS hash of a canonical JSON descriptor of the selected
work and of the host that did it: the commands in order, their working
directory and relevant execution options and environment settings; and the
facts of the host — operating system and its version, architecture, and
the version of every tool `fjs/ci/config` pins. The facts are what ran:
a run outside CI reads them from the host; a CI job states them ahead
from its definition — its platform, the pins — and verifies them once the
tools are installed, failing the job rather than publishing where they
differ ([below](#record-the-facts-do-not-validate-the-host)). A runner label such
as `windows-2025` is not a fact about the work and is not in it: the same
Windows build with the same pins on another CI system must hash the same.
Include the actual selection, even when the same script implements several
operations. A script hash or block label alone does not identify which
operation ran. Define the descriptor schema shared by all publishers before
cache lookup or publication is enabled.

For example, invoking the same `build.mjs` with `lint` or `test` must produce
different contract hashes even if both blocks read exactly the same files.

#### Serialization and CAS identities

Use `stringifySorted` from
[`fjs/media/json`](../../media/json/module.f.mjs) for both the contract
descriptor and the complete `Manifest`. Sort object property names
recursively in lexicographic UTF-16 code-unit order, including file and
directory names together. Preserve array order, including invocation
arguments. Encode the result as UTF-8 with no BOM, whitespace outside
strings, or trailing newline, preserving path spelling and using the
serializer's string escaping.

Use the existing CAS content hashing for canonical contract-descriptor
bytes and complete canonical manifest bytes: initially SHA-256 over each
payload. Source-file IDs come from Git. Encode full IDs with the existing
CBase32 codec, and let CAS own the manifest's sharded path.

The manifest key covers `contract`, `files` and, where present, `below`
— the key of another manifest, chained in by the rungs
[below](#finer-blocks-later), so that a change in the group below changes
this key too. Store the complete canonical JSON manifest unchanged at that
key. Compute keys without
publishing: source files and contract descriptors are not added to
`build-cache` merely to obtain their hashes, and hashing a candidate
manifest does not record success.

#### Initial CI scope and limitations

The initial implementation targets CI building an explicitly selected
committed source snapshot under a controlled build contract. Reuse is
limited by the following boundaries:

- **Commit, index, and working tree are different snapshots.** File IDs
  taken from a commit describe that commit's tree. They do not cover staged
  changes, modified tracked files, or additional untracked inputs. CI pins
  input enumeration to the exact commit being built, where the IDs are free.
  A run over a working tree hashes the files it builds instead, as Git
  would, so what it records is what it built: a dirty tree yields a
  manifest that matches no commit, and no CI reads it
  ([below](#record-the-facts-do-not-validate-the-host)).
- **Blob IDs omit relevant metadata.** Git stores a file's mode separately
  from its blob ID. The current `Tree` leaves do not capture executable
  modes or distinguish a regular file from a symlink containing the same
  bytes. A symlink blob identifies its target text, not automatically the
  contents reached through the link. These are limitations of using blob
  IDs alone; see [Git tree objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects).
- **A clean checkout can still transform bytes.** Line-ending conversion
  and filters can produce working-tree bytes different from the stored
  blob. The supported CI contract must control checkout semantics and
  relevant execution settings; cleanliness alone is insufficient. See
  [checkout attributes](https://git-scm.com/docs/gitattributes).

Do not reuse or publish a success entry for work whose relevant inputs or
semantics are not represented by the selected contract and input identity.
The limitation concerns additional inputs to the contract; outputs generated
by that contract from its declared inputs remain within its scope.

Investigation of [smart builds on developer machines](../../dev/todo/smart-builds.md)
is a follow-up, not a prerequisite for this CI implementation.

#### Build and publication

Every job checks the cache for itself, first thing, and one job at the end
publishes for all of them. No job decides for another, so there is no gate
job ahead of the others, no job outputs to wire, and nothing on the
critical path of a run that misses.

1. **The check, before the expensive setup.** The saving is the setup the
   job never does — the Nix shell, the toolchains, the Rust build — so the
   check runs on the runner's stock tooling: a shallow checkout,
   `setup-node`, the published `fjs` CLI at the pin in `fjs/ci/config` (as
   the Windows jobs already install it), `git fetch --depth 1 origin
   build-cache:build-cache` — a fast-forward of a local branch that is never
   checked out, and only its tip is ever read — then the job's contract,
   its manifest and its key, computed without publishing, and the lookup
   (`fjs cas git get`, or `snapshot` of the local `build-cache`). The
   contract's host facts are not read from the path here, since the Nix
   shell that puts Deno, Bun, Rust and the WASM runtimes on it is the
   setup the check runs ahead of: a CI job states its facts from its
   definition — the platform of its runner, the versions `fjs/ci/config`
   pins — and its pin checks, the first steps after setup, fail the job
   where the installed tools say otherwise, so a job that passed ran the
   facts it stated. Detection is the home run's way of getting the same
   facts, verification CI's; the contract is one. A hit
   ends the job green with every later step skipped, which the generator
   writes as `if: steps.cache.outputs.hit != 'true'` on each; a miss runs
   the job as now. Where `origin` has no `build-cache` yet — the first
   build of a repository — the fetch fails with `couldn't find remote
   ref`, and that is the empty cache, not a failure: `git ls-remote
   --exit-code --heads origin build-cache` exits 2 for it, the lookup goes
   on against the absent local branch, which `snapshot` opens as the empty
   map, and the first publication creates the remote branch. Any other
   fetch failure fails the job. Historical objects, objects in another CAS
   store, and local writes not yet pushed do not establish a successful
   build.
2. **Misses against hits.** On a miss, the common case for a fresh change,
   the check adds seconds to each job and nothing serial, where a gate job
   would have added its whole duration ahead of everything. On a hit, nine
   runners spin up for about a minute each where a gate would have started
   none, in parallel, so latency is the same and only minutes are spent.
   Measure the pre-check cost on macOS and Windows; a gate is a later
   optimization if hits come to dominate, not a prerequisite.
3. **The finalizer publishes.** One job `needs` every other and runs with
   `if: always()`. It sets the bot's identity, since a checkout has none
   and `fjs cas git add` reads one from the repository's `config` and
   refuses without it (`git config user.name "github-actions[bot]"` and
   `git config user.email
   "41898282+github-actions[bot]@users.noreply.github.com"`); then, for
   every job whose `needs.<job>.result` is `success`, it rebuilds that
   job's manifest and writes it through one `add` — a no-op where the
   branch already holds the key, so a job that hit and a job that ran are
   published alike — and, where every job of a rung is green, the rung's
   entry; then `git push origin build-cache`. Each new entry is a commit
   of its own, since `add` commits per entry, so a fresh run pushes a few
   commits and a run of hits pushes none; a batch `add` is not worth
   building for a history nobody reads. There is nothing to collect from
   the runners: a manifest is a function of the commit and the job's
   definition — its commands, its platform, the pins — which the finalizer
   holds as the jobs did, so every job would have computed the same bytes.
   Only this job has `contents: write`; the test jobs run with a read-only
   token, and no `git push` runs from a Windows or macOS runner. It
   publishes only where it can: on a pull request from a fork the token is
   read-only whatever the job asks for, so the finalizer's condition is
   `always()` and the head repository being this one, and a fork's run
   ends green with nothing published rather than red at the push.
4. **The push loop, here alone.** Where the push is refused as a
   non-fast-forward because another run published first, `git fetch origin
   build-cache`, merge it into the local branch in a worktree
   (`git worktree add ../cache build-cache`, then `git merge
   origin/build-cache` there; `--allow-unrelated-histories` where the two
   branches began apart) — different keys are different paths, so
   independent additions never conflict — and push again, a few times. The
   race is between concurrent runs only, never between the jobs of one.

Two rules follow, and the plan holds them as rules. **An entry means these
inputs passed this contract**, once, anywhere: a job is skipped when an
entry exists for its contract over the current manifest, and for no other
reason. **A failure writes nothing**: a failed, cancelled or partial job
has no entry, so it runs again on the same inputs, and no red job hides
behind a green sibling. Together they give the per-job skip. When CI fails
on Windows alone, a PR stacked on that one reruns Windows and hits on every
other job — provided its own changes touch nothing those jobs read, since
the skip is by inputs and not by job history: a stacked PR that edits any
`.mjs` file changes the `js` manifest and reruns every job of that rung,
Windows among them. The same holds for the fix itself: a fix in a
JavaScript file reruns the suite everywhere, and only a fix outside the
other jobs' inputs, or a flaky failure rerun on the same commit, reruns
Windows alone. Both are real and worth having; they are narrower than "only
the failing job reruns".

Keep the source checkout unchanged during cache access and publication:
the backend writes only objects and the branch ref, and the fetch, merge
and push name the branch rather than checking it out. A rung entry — the
`js` one says the suite passed on every engine and platform — is written
only when every job of the rung is green, which only the finalizer can
see; one platform or a narrower check cannot certify it. Another build
system may reuse an entry when its canonical contract and complete inputs
describe equivalent work.

Per-task entries are the step below per-job: a contract per step from the
same manifests, so the expensive steps — coverage, the Rust build — are
skipped inside a job that must run anyway. Setup steps are not skippable,
since the runner is up either way. Worth doing once the per-job cache has
shown where the minutes go.

Clear some or all cache entries with an ordinary deletion commit on the
branch — `git rm` on a checkout of it, or a commit built the same way —
and push it. Membership in the fetched tree determines a hit; Git storage
reclamation is independent. Concurrent additions may appear after cleanup,
merged in as any addition is.

These records establish successful work. Restoring build outputs is a
separate requirement.

#### Any system may read and write the branch

Jobs are self-managed and independent: a job's whole relation to the cache
is fetch the tip, build the manifest from what it builds, look up, and
publish on success. Nothing in an entry says GitHub Actions, so the same
four steps run anywhere — another CI system such as CircleCI, a pipeline
on another Git provider such as GitLab, a developer's machine — against the
same branch, wherever it is hosted. The branch itself can live on another
provider than the code, or on several: a repository with two remotes
fetches from either and merges, and different keys never conflict. A
fork's `build-cache` is its own branch, merged into the main one with
`git merge` when wanted.

Three things decide whether entries from different systems mean the same
thing. The contract is system-neutral, as above: commands and host facts,
no runner labels. Every system runs the same published `fjs` at the same
pin, so manifest and contract bytes agree, and a pin bump invalidates the
cache for everyone at once, which is correct, since the tools changed too.
And trust is per writer: an entry is a claim by whoever could push to the
branch, and its commit says who. On GitHub a fork PR's token is read-only,
so a fork PR reads the cache and cannot write it, which is the right
default and costs nothing, and the finalizer declines to publish there
rather than fail (step 3 above). Where one system's word should not count for
another, give each writer its own branch — `build-cache/github`,
`build-cache/circleci` — and let each reader merge the branches it trusts
into the one it reads. One branch everyone merges into is the trusting
default, and the deletion commit is the way back from a writer that turned
out wrong.

#### Record the facts, do not validate the host

An entry is a record of what was built, by which tools, on which kind of
host, and that it passed. A reader never checks a machine against a rule;
it reads the same facts about itself, computes the key, and asks the
branch. Agreement is a hit, disagreement a miss, and no entry is ever
wrong, only unread.

That one rule replaces the validation a run outside CI would otherwise
need. A machine with the wrong Node is not a failure: its Node version is
in its contract, so its entries are ones nobody else reads, and when the
pin moves, CI reruns everything, with no cleanup, because the facts
changed. A dirty working tree is not a failure either: the manifest is
built from the files that were built, hashed as Git would hash them, so it
matches no commit and no CI reads it; CI keeps reading blob IDs from the
commit's trees, where they are free, and the two spellings of a clean tree
hash the same. The set of facts to read is the pin list: every tool
`fjs/ci/config` pins is one whose version changes results, so the detector
reads each from the path, with the operating system, its version and the
architecture. A fact left out is the one way two different toolsets could
share a key, so the closure of that set matters more than any entry.

In CI the facts are stated, not read, because the check runs before the
tools are installed: the job's definition names its platform and the pins
name its tools, and the pin checks after setup verify the statement, so a
job that passed ran what it stated and the finalizer rebuilds the same
contract from the same definition. The two ways meet in one contract — a
home machine that happens to carry the pinned toolset hashes the same
facts as the CI job for its platform, and reads its entries.

Two things stay outside the rule, because they are not about the cache.
CI's first step still fails a runner whose Node is not the pin: a CI job's
purpose is to test the pinned toolset, and a runner with another Node is a
broken job whatever the cache says. The same detector serves both callers,
one comparing the facts with the pins and refusing, the other hashing them.
And trust stays per writer, since the record says what was built and the
branch says who claims it; the facts do not vouch for the hand that pushed
them.

The property this rests on, to state and keep: the key covers every fact
that can change the result, so two runs that share a key did the same work
with the same tools on the same kind of host, and the only cost of a fact
nobody else shares is an entry nobody else reads.

#### `fjs ci run`, later

Not for now, and the shape is decided. `fjs ci run` runs a CI job on the
machine it is invoked on, as the workflow would: the generator in
[`fjs/ci`](../module.f.mjs) knows every job's commands, so the command runs
them in order, with the check first and the publication on success, and
the workflow and the home run execute the same job definition — the only
way their entries can share a contract. It detects rather than configures:
the operating system and architecture from the host, the tools and their
versions from the path, and picks the job whose contract those facts
satisfy; where a host could run several — the ARM Linux runner carries
four — it runs them in sequence, or takes a job name to narrow. A machine
that matches no job is told which fact failed, not refused on the pin: a
wrong Node is recorded, as above. A dirty tree is recorded too, from the
files as they are, so no clean-tree check is needed before a run, and only
the facts decide whether anyone else ever reads the result.

#### If the native backend is slow

The backend is native: [`fjs/cas/git`](../../cas/git/README.md) reads and
writes objects, trees, commits and the branch ref through
[`fjs/git`](../../git/README.md), and no `git` runs. Its cost on a cache
branch of CI's size is not measured yet, and a job that spends longer in
the lookup than in the work it skips has no cache. If the measurement says
so, the fallback is native Git: the job spawns the `git` CLI for the same
three operations — `git cat-file --batch` to read a key's blob and the
tree it is filed in, `git hash-object -w --no-filters` — the file's bytes
as they are, since a clean or EOL filter would store other bytes under
the key of these — `git mktree` and `git commit-tree` to add one,
`git update-ref` to move the branch — behind
the same `fjs cas git add`, `get` and `list` commands, so nothing else in
the job changes. Calling an external tool from our code needs approval
first ([AGENTS.md §6](../../../AGENTS.md#6-external-tools)), so the
measurement comes first and the approval is asked with it, not assumed
here; the native path stays the one proofs run against the virtual
filesystem, and the CLI path is proved against the real `git` in CI.

#### Finer blocks later

Granularity belongs to input selection and the hashed contract of a block.
The first refinement is decided: the JavaScript block splits into three
rungs, one per set of tools, keyed by three manifests that hash into one
another.

Three nested groups of files, each read by one more tool than the one
below it:

| group | files | read by |
| --- | --- | --- |
| `fjs` | `*.f.mjs`, `*.f.js`, `*.data.js`; `package.json`, `deno.json`; every `gen.*` file in the tree; [`fjs/module.mjs`](../../module.mjs) and [`fjs/emergent_testing`](../../emergent_testing/) | `tsc`, the suite, coverage, `npm start compile`, the `gen` check, the packed-package check |
| `js` | every other JavaScript file (`.mjs`, `.js`, `.cjs`); `package-lock.json`, `deno.lock`, `bun.lock` | `tsc`, the suite, the packed-package check |
| `ts` | every `.ts`; `tsconfig.json` | `tsc`, the packed-package check |

Each group contributes one manifest to `build-cache`: `fjs` lists its
files, `js` lists its files and names the `fjs` manifest's key as `below`,
`ts` lists its files and names the `js` manifest's key. A list entry is a
path and its Git blob id, so building a manifest reads no file. The chain gives each contract the
key it needs, and no diff is ever computed:

| contract | key | changes when |
| --- | --- | --- |
| `npm start compile` | the `fjs` manifest's | FJS changes |
| coverage | the `js` manifest's, until the coverage run loads FunctionalScript proofs only; the `fjs` manifest's after | FJS or JS changes until then; FJS changes after |
| the suite on every engine | the `js` manifest's | FJS or JS changes, never TS alone |
| `tsc` | the `ts` manifest's | any of the three changes |
| the packed-package check — `npm pack`, the clean consumer's `tsc` and run | the `ts` manifest's, since the package holds all three groups | any of the three changes |

A run publishes exactly the entries of the rungs it ran: a TS-only change
runs `tsc` and publishes one entry; an FJS change runs all three and
publishes three. The groups are the exceptions to "select by dependency,
not filename extension" above, and deliberately: for these three tools the
extension is what decides which reads a file. A file that is not code goes
to the lowest rung whose command reads it, so that a hit on that rung never
certifies a command it was never run under: `package.json` and
`deno.json` hold the scripts and tasks coverage, compile and the `gen`
check run — `deno.json` defines the `cov` task itself — so they are `fjs`;
the lockfiles are read by the installs before the suite, so they are
`js`; `tsconfig.json` is `ts`; the tool pins
in [`fjs/ci/config`](../config/module.f.js) are FJS already. The `gen.*`
files are `fjs` for the same reason: the `gen` check compares the
generators' outputs with the tree, and a hand edit of an output, forbidden
as it is, is what that check exists to catch — left out of every list, a
hit would skip the one check that sees it. And the tooling every rung's
command runs through is `fjs`, plain JavaScript though it is: the CLI's
entry point `fjs/module.mjs`, which `npm start` is, and the test runner
and reporter under `fjs/emergent_testing`, which decide which proofs run
and how coverage is read. Other plain JavaScript a `fjs` command reaches
is not chased by hand: that is what the dependency graph below is for.
Until then the `gen` check is the one command of the rung that is not
cached, since its inputs — whatever the generators read, fixtures under
`nanvm/` among them — are not enumerated, and a check whose inputs are not
listed runs on every run rather than hitting on a list that misses one.
Every tracked file of the repository is in one of the three lists, in the
Rust manifest's, or in a named exclusion set of what no command reads —
`todo/`, the changelog, the documents no proof opens — checked, so a new
file cannot go unlisted silently. What a proof reads at run time is listed
where the proof is: `fjs/nanvm/demos/samples/proof.mjs` reads
`spec/**/README.md`, so `spec/` is `js` whole. The exclusion set is the one
judgement in the scheme and is audited by hand; a document a proof is
found to read moves out of it and into that proof's rung, as the spec
pages do here.

Coverage keys on `js` for now, not `fjs`: under coverage today the plain
JavaScript proofs run too, so a `proof.mjs` alone can cover a
FunctionalScript line, and an `fjs` key would keep a cached success a
changed `proof.mjs` no longer earns. Making the coverage run load
FunctionalScript proofs only is
[its own task](../../emergent_testing/todo/coverage-over-fjs-only.md), and
coverage moves to the `fjs` key when it lands. What the `fjs` key then
still does not see is a plain JavaScript module a FunctionalScript proof
imports — a host adapter — since those are `js`: the residual the
dependency graph below closes.

Beyond the rungs, testing only what a change reaches needs the dependency
graph. Three ways to get one, all cheaper than a parser of our own, which
[AGENTS.md §6](../../../AGENTS.md#6-external-tools) would want to be a real
one: the TypeScript API resolves every static `import` and JSDoc `@import`
across `.mjs`, `.f.mjs` and `.ts` in one program, with the pinned tool that
already parses what it checks; a Node module customization hook records
which modules each proof loads during the run that publishes the entry, so
the per-proof input set comes out of the run at no parsing cost; and a block
per directory, whose inputs are its files plus their transitive imports,
is most of the win at a fraction of per-file granularity, since
`npm start test` from a directory already scopes the suite and coverage to
that subtree. What no graph sees — a file a proof reads at run time, a
module only a generator reaches — needs a declared input or the coarse rung.

Individual crates, packages, generators, or proof groups can later have their
own manifests without changing the JSON format, hashing, or CAS layout.

Blocks may overlap: a shared input belongs to every block that reads it.
Coarse and fine blocks can coexist. Blocks with the same `files` and
different `contract` values have distinct cache keys: a lint success cannot
satisfy a test block. Integration work spanning smaller blocks retains its
own complete input set and success condition.

### Tasks

- [x] Complete [branch CAS and its CLI](../../cas/git/README.md)
      before implementing build-cache integration.
- [ ] Define the canonical contract-descriptor schema — the commands and
      the host facts read from the host, one contract per CI job — and the
      two initial input selectors, Rust and JS. Define the representation
      of build-relevant metadata before enabling reuse.
- [ ] Read selected source-file IDs from the exact CI commit and construct
      canonical manifests with the existing Git, JSON, and CAS components.
      Prove deterministic ordering, reuse of stored file IDs without reading
      source blobs, and invalidation when relevant paths, contents, or
      contract parameters change. Cover identical files with different
      invocations producing different keys, and the same contract and inputs
      producing the same key.
- [ ] Enforce the initial CI limitations: cache reuse and publication must
      be unavailable where relevant inputs or metadata are unrepresented,
      or checkout and execution semantics do not match the contract.
- [ ] Integrate the in-job check and the finalizer through the CI
      generator: the check on stock tooling before the setup, every later
      step conditional on the miss, the finalizer with `if: always()` as
      the one writer. Cover failed or incomplete builds producing no entry,
      candidate hashing producing no success record, hits applying only to
      the matching contract, and a hit and a run published alike. Keep the
      consumer usable by other build systems.
- [ ] Measure the pre-check cost on macOS and Windows; decide on a gate job
      from the measurement, not before.
- [ ] Prove `snapshot` reads the tip of a `--depth 1` fetch of
      `build-cache` before the shallow fetch is relied on.
- [ ] Document cleanup and how to add finer, overlapping blocks while
      retaining complete inputs and distinct hashed contracts for different
      work.
- [ ] Split the JavaScript block into the `fjs`, `js` and `ts` rungs: the
      three chained manifests, one contract per rung, the check that every
      tracked file of the repository is listed or excluded by name.
- [ ] Enumerate the `gen` check's inputs from what the generators read,
      and cache it on them; until then it runs on every run.
- [ ] Measure the native backend's lookup and add on a cache branch of
      CI's size; where it is slow, ask approval for the `git` CLI fallback
      and put it behind the same three commands.
- [ ] Per-task entries: a contract per step from the same manifests, once
      the per-job cache has shown where the minutes go.
- [ ] `fjs ci run`: detect the host, pick the job, run it as the workflow
      would, publish on success.

### Related

- [CAS in a Git branch](../../cas/git/README.md) — the backend and CLI; the
  branch moves with `git push` and `git fetch`.
- [Smart builds on developer machines](../../dev/todo/smart-builds.md) —
  separate investigation; no developer-machine design is part of this task.
- [change-aware-ci](./change-aware-ci.md) — classifies changed paths to select
  work; this task reuses success for an exact input set across commits.
- [096-ci-caching](./096-ci-caching.md) — caches the tools needed to run builds.
- [CI generator](../README.md) — owns the generated GitHub workflows.
- [JSON utilities](../../media/json/module.f.mjs) — reuse `stringifySorted`.
