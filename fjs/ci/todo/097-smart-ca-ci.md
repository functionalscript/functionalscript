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
`git merge` and a deletion commit are Git's own, and the job runs them.
This consumer owns input selection, build identity, the success
condition, and the publication loop below. Use CAS hashes for the JSON documents and reuse Git blob IDs for
committed source files. The first target is CI; smart builds on developer
machines are a separate [investigation](../../dev/todo/smart-builds.md).

Initially define two blocks: one for Rust and one for JavaScript and
FunctionalScript. Later add more granular, possibly overlapping blocks using
the same format and publication mechanism.

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
work: its entrypoint and ordered arguments, working directory, relevant
execution options and environment settings, and required checks and
target/platform matrix. Include the actual selection, even when the same
script implements several operations. A script hash or block label alone
does not identify which operation ran. Define the descriptor schema shared
by all publishers before cache lookup or publication is enabled.

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
  changes, modified tracked files, or additional untracked inputs. Pin input
  enumeration to the exact commit being built. Developer-machine workflows
  with mutable local inputs belong to the separate investigation.
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

1. Compute the selected contract, complete input tree, canonical manifest,
   and its CAS key without publishing it.
2. `git fetch origin build-cache:build-cache` — a fast-forward of the
   local branch, which is never checked out — then read that key through
   CAS in it (`snapshot` of the local `build-cache`, or `fjs cas git get`).
   Its presence there allows the corresponding work to be skipped. Where
   `origin` has no `build-cache` yet — the first build of a repository —
   the fetch fails with `couldn't find remote ref`, and that is the empty
   cache, not a failure: `git ls-remote --exit-code --heads origin
   build-cache` exits 2 for it, the lookup goes on against the absent
   local branch, which `snapshot` opens as the empty map, and step 3's
   push creates the remote branch. Any other fetch failure fails the job.
   Historical objects, objects in another CAS store, and local writes not
   yet pushed do not establish a successful build.
3. On a miss, run the block. Only after all checks required by that block
   succeed, write the original complete manifest through CAS — one `add`,
   one commit on the local `build-cache` — and `git push origin
   build-cache`. A failed, cancelled, or partial run adds no entry. The
   checkout has no committer identity of its own, and `fjs cas git add`
   reads one from the repository's `config` and refuses without it, so the
   job sets the bot's first, as any job that commits does:
   `git config user.name "github-actions[bot]"` and `git config user.email
   "41898282+github-actions[bot]@users.noreply.github.com"`.
4. Where the push is refused as a non-fast-forward because another job
   published first, `git fetch origin build-cache`, merge it into the local
   branch in a worktree (`git worktree add ../cache build-cache`, then
   `git merge origin/build-cache` there; `--allow-unrelated-histories` where
   the two branches began apart) — different keys are different paths, so
   independent additions never conflict — and push again, a few times. The
   loop is the job's, in its script; a retry does not repeat the successful
   build.

Keep the source checkout unchanged during cache access and publication:
the backend writes only objects and the branch ref, and the fetch, merge
and push name the branch rather than checking it out. Publish an initial Rust or
JS entry only after its entire hashed contract succeeds; one platform or a
narrower check cannot certify the full block. Another build system may
reuse the entry when its canonical contract and complete inputs describe
equivalent work.

Clear some or all cache entries with an ordinary deletion commit on the
branch — `git rm` on a checkout of it, or a commit built the same way —
and push it. Membership in the fetched tree determines a hit; Git storage
reclamation is independent. Concurrent additions may appear after cleanup,
merged in as any addition is.

These records establish successful work. Restoring build outputs is a
separate requirement.

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
| `fjs` | `*.f.mjs`, `*.f.js`, `*.data.js`; `package.json`; every `gen.*` file in the tree; [`fjs/emergent_testing`](../../emergent_testing/) | `tsc`, the suite, coverage, `npm start compile`, the `gen` check |
| `js` | every other JavaScript file (`.mjs`, `.js`, `.cjs`); `package-lock.json`, `deno.json`, `deno.lock`, `bun.lock` | `tsc`, the suite |
| `ts` | every `.ts`; `tsconfig.json` | `tsc` |

Each group contributes one manifest to `build-cache`: `fjs` lists its
files, `js` lists its files and names the `fjs` manifest's key as `below`,
`ts` lists its files and names the `js` manifest's key. A list entry is a
path and its Git blob id, so building a manifest reads no file. The chain gives each contract the
key it needs, and no diff is ever computed:

| contract | key | changes when |
| --- | --- | --- |
| coverage, `npm start compile`, the `gen` check | the `fjs` manifest's | FJS changes |
| the suite on every engine | the `js` manifest's | FJS or JS changes, never TS alone |
| `tsc` | the `ts` manifest's | any of the three changes |

A run publishes exactly the entries of the rungs it ran: a TS-only change
runs `tsc` and publishes one entry; an FJS change runs all three and
publishes three. The groups are the exceptions to "select by dependency,
not filename extension" above, and deliberately: for these three tools the
extension is what decides which reads a file. A file that is not code goes
to the lowest rung whose command reads it, so that a hit on that rung never
certifies a command it was never run under: `package.json` holds the
scripts coverage, compile and the `gen` check run, so it is `fjs`; the
lockfiles and the Deno and Bun configuration are read by the installs
before the suite, so they are `js`; `tsconfig.json` is `ts`; the tool pins
in [`fjs/ci/config`](../config/module.f.js) are FJS already. The `gen.*`
files are `fjs` for the same reason: the `gen` check compares the
generators' outputs with the tree, and a hand edit of an output, forbidden
as it is, is what that check exists to catch — left out of every list, a
hit would skip the one check that sees it. And the test runner and
reporter under `fjs/emergent_testing` are `fjs`, plain JavaScript though
they are, since they decide which proofs run and how coverage is read.
Every tracked file under `fjs/` is in one of the three lists or in a named
exclusion set, checked, so a new fixture cannot go unlisted silently.

What the `fjs` key still does not see is a plain JavaScript module that a
FunctionalScript proof imports — a host adapter — since those are `js`.
Under coverage today the plain JavaScript proofs run too, so a `proof.mjs`
alone can cover a FunctionalScript line; making the coverage run load
FunctionalScript proofs only is
[its own task](../../emergent_testing/todo/coverage-over-fjs-only.md), and
the adapters are the residual the dependency graph below closes.

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
- [ ] Define the canonical contract-descriptor schema and the two initial
      Rust and JS contracts, including the selected invocation and execution
      parameters. Define complete input selectors and the representation
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
- [ ] Integrate CAS lookup and success-only publication through the CI
      generator. Cover failed or incomplete builds producing no entry,
      candidate hashing producing no success record, and hits applying only
      to the matching contract. Keep the consumer usable by other build
      systems.
- [ ] Document cleanup and how to add finer, overlapping blocks while
      retaining complete inputs and distinct hashed contracts for different
      work.
- [ ] Split the JavaScript block into the `fjs`, `js` and `ts` rungs: the
      three chained manifests, one contract per rung, the check that every
      tracked file under `fjs/` is listed or excluded by name.
- [ ] Measure the native backend's lookup and add on a cache branch of
      CI's size; where it is slow, ask approval for the `git` CLI fallback
      and put it behind the same three commands.

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
