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

The manifest key covers both `contract` and `files`. Store the complete
canonical JSON manifest unchanged at that key. Compute keys without
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
2. `git fetch origin build-cache`, then read that key through CAS in the
   fetched branch (`snapshot` of `refs/remotes/origin/build-cache`, or
   `fjs cas git get` on a local branch reset to it). Its presence there
   allows the corresponding work to be skipped. Historical objects, objects
   in another CAS store, and local writes not yet pushed do not establish
   a successful build.
3. On a miss, run the block. Only after all checks required by that block
   succeed, write the original complete manifest through CAS — one `add`,
   one commit on the local `build-cache` — and `git push origin
   build-cache`. A failed, cancelled, or partial run adds no entry.
4. Where the push is refused as a non-fast-forward because another job
   published first, `git fetch` and `git merge origin/build-cache` — different
   keys are different paths, so independent additions never conflict — and
   push again, a few times. The loop is the job's, in its script; a retry
   does not repeat the successful build.

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

#### Finer blocks later

Granularity belongs to input selection and the hashed contract of a block.
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
