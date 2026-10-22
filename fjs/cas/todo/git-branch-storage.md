## Store CAS content in a Git branch

**Priority:** P3
**Status:** wip

### Problem

CAS currently stores content in the filesystem. Its CLI constructs
`fileCas(sha256)(home)` for `add`, `get`, and `list`. A consumer such as
the [build cache](../../ci/todo/097-smart-ca-ci.md) needs to read and publish
CAS content in a separate Git branch while the source checkout stays on its
current branch.

### Proposal

Implement a reusable Git branch backend for CAS, including CLI access.
Expose content through the existing [CAS interface](../types.ts); the
backend owns branch configuration, commits, and publication. Keep build
contracts and success conditions in the build-cache consumer.

This is the first stage of the build-cache plan. The second stage uses this
backend for the `build-cache` branch.

#### Content identities and storage

Use the existing CAS content hashes, initially SHA-256 over the payload
bytes, as the current CLI does. Reuse the existing
[CBase32 codec](../../basen/cbase32/module.f.mjs) and
[`toPath`](../module.f.mjs) for the `.cas/ab/cd/<rest>` layout. Store the
complete payload unchanged at its CAS path, with regular, non-executable
Git file mode `100644`.

CAS content addresses remain its existing hashes. The Git backend uses
Git object IDs internally, separately from the keys accepted by CAS.
A stored document may contain other identifiers, such as the Git blob IDs
that the build cache uses for source files. Using Git hashes as CAS
content addresses is deferred.

Provide content-key computation without storing or publishing the payload,
using the same hash implementation as CAS `write`. For identical bytes,
the computed key and the key returned by `write` must agree. The current
`Cas` exposes `read`, `write`, and `list`; hash-only computation and
branch publication are capabilities to design, not existing methods.

#### Branch access and CLI

Select the repository, remote, and branch explicitly through the backend
configuration and CLI. Read the selected branch at a known commit; `read`
and `list` use that snapshot's CAS paths. Content in another branch, Git
history, the local object database, or an unpublished staging area does not
establish membership in the selected published snapshot.

Create trees and commits and push to the named ref without switching the
source checkout's `HEAD` or modifying its working tree or index. Initialize
a missing branch and handle concurrent initial publishers.

Extend the CAS CLI so its `add`, `get`, and `list` operations can use this
backend, and expose the branch publication operations it requires. The CLI
and programmatic callers must share the backend's behavior. Define the
public configuration and command syntax before implementation; do not
duplicate hashing, publication, or retry logic in a CLI handler.

#### Publication and concurrent writers

A writer retains the branch snapshot `A` it started from. Its proposed
commit `B` adds complete CAS objects to that tree, with `A` as parent.
An incomplete write publishes no partial object.

Existing entries are never edited, overwritten, renamed, or given another
mode. Different hashes add different paths; the same hash denotes the same
bytes, assuming no collision. The branch tree is a map from canonical CAS
paths to immutable content, and identical concurrent additions also agree
on file mode.

Push normally to the selected ref. If another writer advances it, fetch the
new head and reconcile it with the proposal through their actual merge
base, then retry. Preserve the proposal's ancestry across retries.
Identical additions need only one stored object. During initial branch
creation, concurrent roots reconcile against the empty initial map.

Reconcile by exact path, preserving cleanup deletions. Do not union complete
parent trees or blindly re-add every local object. Disable rename inference:
similar content at different hash paths represents distinct entries. With
the Git CLI, the corresponding merge option is `-Xno-renames`; a native
merge must have the same path semantics. Independent additions then avoid
content merge conflicts, while concurrent ref updates still require
normal-push retries. Ordinary publication never force-pushes.

#### Cleanup

Cleanup may remove some or all entries through an ordinary deletion commit.
An entry absent from the selected published tree is absent from that CAS
snapshot, even while its bytes remain in Git history. Removing membership
and reclaiming Git object storage are independent operations.

Three-way reconciliation preserves a deletion when the other side left
that base entry unchanged. For example:

| Snapshot | Entries |
| --- | --- |
| Common base `A` | `A0, A1` |
| Local proposal `B` | `A0, A1, B0, B1` |
| Remote head `C` | `A1, C0` |
| Merge result | `A1, B0, B1, C0` |

This merges without conflict and does not restore `A0`. If the remote
independently added and then deleted `B0` and `B1` after `A`, its net change
to those paths is still empty: the local additions return without conflict.
If a record already existed in the actual merge base and only cleanup
changed it, deletion wins. Merging an old commit already included in the
cleanup branch's ancestry does not restore its deleted entries.

Clearing the branch removes its current entries but allows independent,
in-flight additions to appear afterward. Ordinary deletion commits can
coexist with active writers. History compaction is separate maintenance
and is not required to clear the store. These rules follow
[Git's three-way merge behavior](https://git-scm.com/docs/git-merge), with
rename detection disabled for the CAS map.

### Tasks

- [x] Define the backend configuration and the snapshot: `Branch` selects
      the repository, remote and branch, `snapshotRef` is where the
      published snapshot is read, and `snapshot` is it as a `CasReader`, the
      read half of `Cas<O>` — [`fjs/cas/git`](../git/module.f.mjs).
- [x] Define the proposal a writer adds to: `proposal` is a branch as a
      whole `Cas<O>`, its ref `proposalRef`, its commits by an `Author`
      the caller names — [`fjs/cas/git`](../git/module.f.mjs).
- [x] Define the publication API: `publish` carries the proposal to the
      remote branch through a `Remote` — fetch, push and the merge base —
      and creates a missing branch; `gitRemote` is the remote over the
      `git` command line — [`fjs/cas/git`](../git/module.f.mjs).
- [x] Provide content-key computation without storage or publication,
      sharing CAS's configured hash implementation. Prove agreement with
      the key returned by `write` for the same bytes — `contentKey` in
      [`fjs/cas`](../module.f.mjs).
- [x] Implement byte-preserving CAS reads and listing of a snapshot,
      reusing the existing encoding, paths, and Git primitives — `casAt` in
      [`fjs/cas/git`](../git/module.f.mjs), over the object store's reader,
      the walk and the ref store, in SHA-1 and SHA-256 repositories.
- [x] Implement branch storage: byte-preserving CAS writes into the
      repository's own objects and a proposal ref, reusing the same
      primitives — `writeObject` and `proposal`'s `write` in
      [`fjs/cas/git`](../git/module.f.mjs), the loose file through
      [`fjs/zlib/stored`](../../zlib/stored/module.f.mjs). Proved that the
      source checkout's HEAD, working tree, and index stay unchanged. Two
      limits are filed beside the module: a payload held in memory while
      its object is written, and two local writers of one repository.
- [x] Implement commit/push publication and cleanup. Covered: incomplete
      writes, identical concurrent additions, concurrent initialization,
      normal-push retries, and the three-way deletion cases above — the
      reconciliation is native and by exact path, so no rename inference
      exists to relocate similar objects. `remove` and `clear` are the
      deletion commits; `publish` the push, the retry and the merge —
      [`fjs/cas/git`](../git/module.f.mjs).
- [ ] Add CLI access to the same backend and document branch selection,
      reads, writes, listing, publication, and cleanup. Prove CLI and API
      behavior agree without a second implementation of the protocol.

### Related

- [Build cache](../../ci/todo/097-smart-ca-ci.md) — consumes branch CAS to
  remember successful build contracts and input sets.
- [CAS](../README.md) and [CAS CLI](../cli/module.f.mjs) — existing storage
  and command behavior to reuse.
- [Command architecture](./command-architecture.md) — shared operation
  declarations and transport boundaries.
- [Git](../../git/README.md) — repository and object primitives.
