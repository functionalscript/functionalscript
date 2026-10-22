## Cache successful builds by their inputs

**Priority:** P3
**Status:** open
**Blocked by:** [CAS in a Git branch](../../cas/todo/git-branch-storage.md)

### Problem

CI repeats work when the relevant build inputs have already passed, including
when the same inputs appear in another commit or a merge-queue entry. Record
successful input sets so GitHub CI and other build systems can reuse the
result.

### Proposal

Implement this in two stages:

1. Add [CAS support for a non-current Git branch](../../cas/todo/git-branch-storage.md),
   including CLI access.
2. Use that CAS backend to create and read the `build-cache` branch in the
   same repository and publish complete JSON manifests after build success.

The CAS backend owns branch access, commits, pushes, retries, and cleanup.
This consumer owns input selection, build identity, and the success
condition. Use the existing CAS hashes and layout; Git-based content
identities are deferred.

Initially define two blocks: one for Rust and one for JavaScript and
FunctionalScript. Later add more granular, possibly overlapping blocks using
the same format and publication mechanism.

#### Manifest format

```ts
type Hash = string // Full CAS key encoded with existing CBase32

type Tree = {
    readonly [name: string]: Tree | Hash
}

type Manifest = {
    readonly contract: Hash
    readonly files: Tree
}
```

The `files` root is relative to the repository root. Each key is one path
component; an object represents a directory, and a string is the CAS hash of
the selected file's contents. Include every input the block depends on,
including relevant build scripts, configuration, dependency lockfiles,
toolchain pins, generator inputs, and test data. Select by dependency, not
filename extension.

Construct the identity from the snapshot actually built, including dirty or
untracked inputs if supported. The complete input definition must account
for build-relevant file kinds, executable modes, symlink behavior, and
checkout transformations before enabling reuse. File-content hashes alone
do not capture those distinctions. Define how the initial contracts include
them in the hashed identity; affected work must bypass reuse until its
inputs are fully represented.

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

Use the existing CAS content hashing for source-file bytes, canonical
contract-descriptor bytes, and complete canonical manifest bytes: initially
SHA-256 over each payload. Reuse the existing CBase32 encoding and sharded
path implementation through CAS.

The manifest key covers both `contract` and `files`. Store the complete
canonical JSON manifest unchanged at that key. Compute keys without
publishing: source files and contract descriptors are not added to
`build-cache` merely to obtain their hashes, and hashing a candidate
manifest does not record success.

#### Build and publication

1. Compute the selected contract, complete input tree, canonical manifest,
   and its CAS key without publishing it.
2. Read that key through CAS in a fetched `build-cache` branch snapshot.
   Its presence there allows the corresponding work to be skipped.
   Historical objects, objects in another CAS store, and unpublished local
   writes do not establish a successful build.
3. On a miss, run the block. Only after all checks required by that block
   succeed, write the original complete manifest through CAS and publish it
   to `build-cache`. A failed, cancelled, or partial run adds no entry.
4. Let the branch backend handle commit creation, concurrency, and retries.
   A publication retry does not repeat the successful build.

Keep the source checkout unchanged during cache access and publication,
using the backend's explicit branch operations. Publish an initial Rust or
JS entry only after its entire hashed contract succeeds; one platform or a
narrower check cannot certify the full block. Another build system may
reuse the entry when its canonical contract and complete inputs describe
equivalent work.

Use the backend's ordinary deletion commits to clear some or all cache
entries. Membership in the current published tree determines a hit; Git
storage reclamation is independent. Concurrent additions may appear after
cleanup, as specified in the branch-CAS task.

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

- [ ] Complete [branch CAS and its CLI](../../cas/todo/git-branch-storage.md)
      before implementing build-cache integration.
- [ ] Define the canonical contract-descriptor schema and the two initial
      Rust and JS contracts, including the selected invocation and execution
      parameters. Define complete input selectors and the representation
      of build-relevant metadata before enabling reuse.
- [ ] Construct and hash canonical manifests using the existing JSON and
      CAS components. Prove deterministic ordering and invalidation when
      relevant paths, contents, metadata, or contract parameters change.
      Cover the same files with different invocations producing different
      keys, and the same contract and inputs producing the same key.
- [ ] Integrate CAS lookup and success-only publication through the CI
      generator. Cover failed or incomplete builds producing no entry,
      candidate hashing producing no success record, and hits applying only
      to the matching contract. Keep the consumer usable by other build
      systems.
- [ ] Document cleanup and how to add finer, overlapping blocks while
      retaining complete inputs and distinct hashed contracts for different
      work.

### Related

- [CAS in a Git branch](../../cas/todo/git-branch-storage.md) — prerequisite
  backend and CLI, including publication and cleanup.
- [change-aware-ci](./change-aware-ci.md) — classifies changed paths to select
  work; this task reuses success for an exact input set across commits.
- [096-ci-caching](./096-ci-caching.md) — caches the tools needed to run builds.
- [CI generator](../README.md) — owns the generated GitHub workflows.
- [JSON utilities](../../media/json/module.f.mjs) — reuse `stringifySorted`.
