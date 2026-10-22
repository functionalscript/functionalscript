## Cache successful builds by their inputs

**Priority:** P3
**Status:** open

### Problem

CI repeats work when the relevant build inputs have already passed, including
when the same inputs appear in another commit or a merge-queue entry. Record
successful input sets in Git so GitHub CI and other build systems can reuse
the result.

### Proposal

Store immutable JSON manifests in a dedicated `build-cache` branch. A
manifest identifies a block's selected build contract and complete file inputs.
Its presence in that branch records that this contract succeeded for these
inputs.

Initially define two blocks: one for Rust and one for JavaScript and
FunctionalScript. Later add more granular blocks using the same format and
publication mechanism.

#### Manifest format

```ts
type Hash = string // Git BLOB hash encoded as lowercase CBase32

type Tree = {
    readonly [name: string]: Tree | Hash
}

type Manifest = {
    readonly contract: Hash
    readonly files: Tree
}
```

The `files` root is relative to the repository root. Each key is one path
component; an object represents a directory, and a string is the Git BLOB
hash of the selected file's contents. Include every file the block depends on, including
relevant build scripts, configuration, dependency lockfiles, toolchain pins,
generator inputs, and test data. Select by dependency, not filename extension.

`contract` is the Git BLOB hash of a canonical JSON descriptor of the
selected work: its entrypoint and ordered arguments, working directory,
relevant execution options and environment settings, and required checks and
target/platform matrix. Include the actual selection, even when the same
script implements several operations. A script hash or block label alone
does not identify which operation ran. The first task defines the descriptor
schema shared by all publishers before cache lookup or publication is enabled.

For example, invoking the same `build.mjs` with `lint` or `test` must produce
different contract hashes even if both blocks read exactly the same files.

Use `stringifySorted` from
[`fjs/media/json`](../../media/json/module.f.mjs) for both the contract descriptor
and the complete `Manifest`. The cache key hashes the complete manifest,
including `contract` and `files`. Sort object property names recursively in
lexicographic UTF-16 code-unit order, including file and directory names
together. Preserve array order, including invocation arguments. Encode the
result as UTF-8 with no BOM, whitespace outside strings, or trailing newline.
Preserve path spelling and use the serializer's string escaping.

For bytes `b`, the Git BLOB hash is:

```text
SHA1(UTF8("blob " + decimal(b.length)) + NUL + b)
```

Here `b.length` is the byte length. Use this hash for source file contents
and the canonical bytes of the contract descriptor and complete manifest.
Encode the full 20-byte digest directly as 32 lowercase Crockford Base32
characters, preserving leading zeros, with no padding or check symbol.
The alphabet is:

```text
0123456789abcdefghjkmnpqrstvwxyz
```

For the manifest ID `h`, its path within `build-cache` is:

```text
h[0:2]/h[2:4]/h[4:] + ".json"
```

The stored file is exactly the canonical bytes that were hashed. Use one
ordinary, non-executable file mode for all entries and preserve those bytes
when committing them.

#### Build and publication

1. Compute the contract descriptor and manifest from the selected work and
   inputs that will actually be built.
2. Look up its CAS path in the published `build-cache` tree. A matching entry
   allows the corresponding work to be skipped. A Git BLOB merely existing
   in the object database is not a success record.
3. On a miss, run the block. Publish the original manifest only after all
   checks required by that block succeed; a failed, cancelled, or partial
   run adds no entry.
4. Fetch the latest `build-cache` head. If the same entry is already present,
   publication is complete. Otherwise add the missing entries and commit on
   that head.
5. Push normally. If another writer advanced the branch, fetch, reapply the
   missing additions, and retry publication without repeating the build.

Only complete success manifests are published; computing a contract hash does
not publish a success record. Entries are append-only: never edit or overwrite
an existing manifest. Different hashes add different paths; the same hash
denotes the same bytes,
assuming no collision. These additions combine without content merge
conflicts. Concurrent updates of the branch head still require the retry
above.

Publish an initial Rust or JS entry only after its entire hashed contract
succeeds; one platform or a narrower check cannot certify the full block.
Another build system may reuse the entry when it uses the same canonical
contract descriptor and file inputs for equivalent work.

The initial tree records file contents. Account for executable modes or
symlink semantics before reusing a result for work that depends on them.
These records establish successful work; restoring build outputs is separate.

#### Finer blocks later

Granularity belongs to input selection and the hashed contract of a block.
Individual crates, packages, generators, or proof groups can later have their
own manifests without changing the JSON format, hashing, or CAS layout.

Blocks may overlap: a shared input belongs to every block that reads it.
Coarse and fine blocks can coexist, and existing entries remain valid for
their original contracts. Blocks with the same `files` and different
`contract` values have distinct cache keys: a lint success cannot satisfy a
test block. Integration work spanning smaller blocks retains its own complete
input set and success condition.

### Tasks

- [ ] Define the canonical contract-descriptor schema and the two initial
      Rust and JS contracts, including the selected invocation and execution
      parameters. Define their complete input selectors, including shared
      dependencies, build definitions, toolchain pins, and required checks and
      platforms.
- [ ] Implement manifest construction, canonical serialization, Git BLOB
      hashing, and CBase32 paths using existing modules. Add proofs for
      deterministic ordering and invalidation when selected paths, contents,
      or contract parameters change. Cover identical file trees with different
      invocations producing different keys, and identical contracts and files
      producing the same key.
- [ ] Implement branch lookup and append-only publication, covering cache
      misses, identical concurrent additions, and retries after the branch
      head advances.
- [ ] Integrate lookup and success-only publication through the CI generator.
      Cover failed or incomplete builds producing no entry and cache hits
      applying only to the matching block contract. Keep the core mechanism
      usable by other build systems.
- [ ] Document how to add finer, overlapping blocks while retaining complete
      inputs and distinct hashed contracts for different work.

### Related

- [change-aware-ci](./change-aware-ci.md) — classifies changed paths to select
  work; this task reuses success for an exact input set across commits.
- [096-ci-caching](./096-ci-caching.md) — caches the tools needed to run builds.
- [CI generator](../README.md) — owns the generated GitHub workflows.
- [JSON utilities](../../media/json/module.f.mjs) — reuse `stringifySorted`.
