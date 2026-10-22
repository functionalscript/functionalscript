## Cache successful builds by their inputs

**Priority:** P3
**Status:** open

### Problem

CI repeats work when the relevant build inputs have already passed, including
when the same inputs appear in another commit or a merge-queue entry. Record
successful input sets in Git so GitHub CI and other build systems can reuse
the result.

### Proposal

Store complete, immutable JSON manifests through CAS in a dedicated
`build-cache` branch of the same repository. A manifest identifies a block's
selected build contract and complete file inputs. Its presence in the current
published branch tree records that this contract succeeded for these inputs.

Initially define two blocks: one for Rust and one for JavaScript and
FunctionalScript. Later add more granular, possibly overlapping blocks using
the same format and publication mechanism.

#### Manifest and Git identities

```ts
type GitBlobHash = string // Full Git blob ID encoded with existing CBase32
type GitTreeHash = string // Full Git tree ID encoded with existing CBase32

type Manifest = {
    readonly contract: GitBlobHash
    readonly files: GitTreeHash
}
```

Use Git object identities throughout:

| Value | Git object |
| --- | --- |
| Source file | Blob containing the file's bytes |
| `files` | Tree of the block's selected inputs |
| `contract` | Blob containing the canonical JSON contract descriptor |
| Manifest ID | Blob containing the complete canonical JSON manifest |

The selected input tree is rooted at the repository root and preserves
repository-relative paths, entry modes, and object IDs. Include every input
the block depends on, including relevant build scripts, configuration,
dependency lockfiles, toolchain pins, generator inputs, and test data.
Select by dependency, not filename extension.

Reuse existing blobs and entire subtrees where they represent exactly the
selected inputs. Otherwise construct a selected tree from the relevant Git
entries, preserving their paths and modes. A standalone subtree ID does not
include its location: retain the ancestors that place it at its
repository-relative path. Use Git's native tree representation and ordering,
including directory ordering, rather than hashing a JSON description of a
tree.

Construct the identity from the snapshot actually built. A committed tree
does not cover dirty or untracked inputs; checkout transformations and
execution settings that affect the work must be covered by the contract.

`contract` is the Git blob ID of a canonical JSON descriptor of the selected
work: its entrypoint and ordered arguments, working directory, relevant
execution options and environment settings, and required checks and
target/platform matrix. Include the actual selection, even when the same
script implements several operations. A script hash or block label alone
does not identify which operation ran. The first task defines the descriptor
schema shared by all publishers before cache lookup or publication is enabled.

For example, invoking the same `build.mjs` with `lint` or `test` must produce
different contract hashes even if both blocks have the same selected input
tree ID.

#### Serialization and CAS reuse

Use `stringifySorted` from
[`fjs/media/json`](../../media/json/module.f.mjs) for both the contract
descriptor and the complete `Manifest`. Sort JSON object property names
recursively in lexicographic UTF-16 code-unit order. Preserve array order,
including invocation arguments. Encode the result as UTF-8 with no BOM,
whitespace outside strings, or trailing newline, using the serializer's
string escaping. This JSON ordering does not replace Git's tree ordering.

Initially use SHA-1 Git object IDs. For object type `t` and payload bytes
`b`, the identity is:

```text
SHA1(UTF8(t + " " + decimal(b.length)) + NUL + b)
```

Here `b.length` is the byte length, and `t` is `blob` or `tree` as
appropriate. Reuse [Git object hashing](../../git/oid/module.f.mjs) and
[tree serialization](../../git/tree/module.f.mjs), including validation of
Git's canonical tree ordering.

Reuse the existing [CAS interface](../../cas/types.ts),
[`toPath`](../../cas/module.f.mjs), and
[CBase32 codec](../../basen/cbase32/module.f.mjs) for full digest bytes.
`toPath` owns the sharded `.cas/ab/cd/<rest>` layout; do not introduce a
second encoding, shard rule, or file extension. The current `fileCas` hashes
the raw payload with SHA-2. A Git-backed CAS must instead use Git object
framing and the selected Git hash algorithm.

The manifest ID hashes the complete canonical manifest, including
`contract` and `files`. Store those exact JSON bytes at its CAS path as a
regular, non-executable Git file (`100644`). Publish the complete record
only after success.

Keep the hash algorithm choice explicit so another Git object format can be
introduced later. A separate planned system will bind SHA-1 identities to
stronger hashes using signatures and trusted timestamps; that system is
outside this task.

IDs written inside JSON do not make their referenced objects reachable to
Git garbage collection. These records identify successful work; retaining
the referenced source/contract objects and restoring build outputs are
separate requirements.

#### Build and publication

The CAS integration must read from, create commits for, and push to the
explicit `refs/heads/build-cache` ref while another source branch is checked
out. It must not switch the source checkout's `HEAD` or modify its working
tree or index. Reuse the existing CAS and Git primitives, adding the missing
branch publication capabilities rather than assuming `fileCas` already
provides them.

1. Compute the contract descriptor and manifest from the selected work and
   actual inputs. Fetch the cache ref and retain its commit as snapshot `A`.
2. Look up the manifest's CAS path in `A`'s published tree. A matching entry
   allows the corresponding work to be skipped. Objects in Git history or
   the object database, and locally staged records, do not establish a hit.
3. On a miss, run the block. Only after all checks required by that block
   succeed, add the original manifest to `A`'s tree and create proposal
   commit `B` with parent `A`. A failed, cancelled, or partial run adds no
   entry. Initialize the cache branch if it does not yet exist, handling a
   concurrent first publisher.
4. Push the proposal normally to `refs/heads/build-cache`. If another writer
   advanced that ref, fetch its new head and reconcile it with the proposal
   through their actual merge base, then retry without repeating the build.
   Preserve the proposal's ancestry across retries. Identical additions need
   only one stored record. During initial branch creation, concurrent roots
   reconcile against the empty initial map.

CI proposes additions only. Existing records are never edited, overwritten,
renamed, or given another mode. Different hashes add different paths; the
same hash denotes the same bytes, assuming no collision. The branch tree is
a map from canonical CAS paths to immutable records, with identical
concurrent additions also agreeing on file mode.

Reconciliation is a three-way merge of this map by exact path, preserving
cleanup deletions as described below. It must not union the complete parent
trees or blindly re-add every local record. Disable rename inference:
similar JSON at different hash paths represents distinct entries. With the
Git CLI, the corresponding merge option is `-Xno-renames`; a native merge
must have the same path semantics. Under these invariants, independent
additions do not cause content merge conflicts. Concurrent branch updates
still require normal-push retries; ordinary publication never force-pushes.

Publish an initial Rust or JS entry only after its entire hashed contract
succeeds; one platform or a narrower check cannot certify the full block.
Another build system may reuse an entry when it uses the same canonical
contract descriptor and input tree for equivalent work.

#### Cleanup and concurrent writers

Cleanup may remove some or all records through an ordinary deletion commit.
A record absent from the current published tree is a cache miss, even while
its blob remains in Git history. Removing membership and reclaiming Git
object storage are independent operations.

Three-way reconciliation preserves a deletion when the other side left
that base entry unchanged. For example:

| Snapshot | Entries |
| --- | --- |
| Common base `A` | `A0, A1` |
| CI proposal `B` | `A0, A1, B0, B1` |
| Remote head `C` | `A1, C0` |
| Merge result | `A1, B0, B1, C0` |

This merges without conflict and does not restore `A0`. If the remote
independently added and then deleted `B0` and `B1` after `A`, its net change
to those paths is still empty: the CI additions return without conflict.
If a record already existed in the actual merge base and only cleanup
changed it, deletion wins. Merging an old commit already included in the
cleanup branch's ancestry does not restore its deleted entries.

Thus clearing the branch evicts its current records; it does not prevent
independent, in-flight additions from appearing afterward. Ordinary deletion
commits can coexist with active CI. Any later history compaction is separate
maintenance and is not required to clear the cache. These rules follow
[Git's three-way merge behavior](https://git-scm.com/docs/git-merge), with
rename detection disabled for the cache map.

#### Finer blocks later

Granularity belongs to input selection and the hashed contract of a block.
Individual crates, packages, generators, or proof groups can later have their
own manifests without changing the JSON format, hashing, or CAS layout.

Blocks may overlap: a shared input belongs to every block that reads it.
Coarse and fine blocks can coexist, and existing entries remain valid for
their original contracts. Blocks with the same `files` and different
`contract` values have distinct cache keys: a lint success cannot satisfy a
test block. Integration work spanning smaller blocks retains its own
complete input set and success condition.

### Tasks

- [ ] Define the canonical contract-descriptor schema and the two initial
      Rust and JS contracts, including the selected invocation and execution
      parameters. Define their complete input selectors, including shared
      dependencies, build definitions, toolchain pins, and required checks
      and platforms.
- [ ] Construct selected Git input trees and canonical manifests using the
      existing JSON, Git, and CAS modules. Prove deterministic identities,
      reuse of matching subtrees, and invalidation when selected paths,
      contents, modes, or contract parameters change. Cover the same input
      tree with different invocations producing different keys, and the
      same contract and inputs producing the same key.
- [ ] Add CAS access to the non-current cache branch: read explicit
      snapshots, create trees and commits, and push the named ref without
      changing the source checkout's HEAD, working tree, or index.
- [ ] Implement success-only immutable-record publication and ordinary
      cleanup commits. Cover missing-branch initialization, cache misses,
      identical concurrent additions, normal-push retries, and three-way
      deletion behavior. Include similar JSON records at different hash
      paths to prove rename inference cannot relocate them.
- [ ] Integrate lookup and publication through the CI generator. Cover
      failed or incomplete builds producing no entry and cache hits applying
      only to the matching block contract. Keep the core mechanism usable
      by other build systems.
- [ ] Document cleanup and how to add finer, overlapping blocks while
      retaining complete inputs and distinct hashed contracts for different
      work.

### Related

- [change-aware-ci](./change-aware-ci.md) — classifies changed paths to select
  work; this task reuses success for an exact input set across commits.
- [096-ci-caching](./096-ci-caching.md) — caches the tools needed to run builds.
- [CI generator](../README.md) — owns the generated GitHub workflows.
- [JSON utilities](../../media/json/module.f.mjs) — reuse `stringifySorted`.
- [CAS](../../cas/module.f.mjs) — reuse the interface, encoding, and paths.
- [Git](../../git/README.md) — reuse object identities and tree primitives.
