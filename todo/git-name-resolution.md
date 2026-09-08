## Git names and relative name resolution

**Priority:** P3
**Status:** open

### Problem

Content hashes are universal immutable addresses, but they are not the names
people use to collaborate. A module, document, repository, or other evolving
object needs a human-readable name whose meaning is relative to a trust root,
not a globally allocated DNS-like namespace.

The DISOT architecture already describes paths such as:

```text
~/Alice/Bob/plan.md
/secp256k1:<key>/Alice/Bob/plan.md
```

where every hop is authenticated and `~` is relative to a root identity. Git
already gives us immutable commit objects, ancestry, merges, ordinary transport,
and signatures. The missing piece for using Git commits directly in this model
is a small naming convention plus a resolver that can turn a relative name into
an exact immutable commit/content address.

The design must keep three things separate:

1. **name** — human-readable, contextual, mutable through history;
2. **identity / trust root** — whose namespace gives the name meaning;
3. **hash** — the final immutable object selected by resolution.

A signer is not automatically the namespace root. This distinction matters for
forks: another person may sign new commits in a fork without silently changing
what the fork's existing relative dependencies mean.

### Commit `name`

Prototype one optional, non-repeatable Git commit header:

```text
tree <tree>
parent <parent>
name coolPythonModule
author ...
committer ...

<message>
```

`name` is a human-readable name for the logical object represented by the
commit. It is not a Git ref, branch name, DNS name, or globally unique package
name. Its meaning is always relative to a namespace root.

A sequence of commits with the same effective root/name and connected ancestry
is the evolution of one named object. A new commit does not acquire a new
logical identity merely because another signer created it; signatures say who
attested to a commit, not what namespace its relative references belong to.

Conversely, two unrelated histories that happen to use the same string are not
silently the same object. They are distinct candidates/forks until ancestry,
trust policy, an explicit root, or a lock selects one.

The prototype must decide and pin the exact textual domain of `name` (UTF-8,
normalization, reserved separators, empty name, and maximum size). The initial
format should prefer one path segment per `name`; path structure belongs to the
resolver rather than to one commit header.

Unknown commit headers are part of the commit bytes. Compatibility tests must
prove that stock Git preserves `name` through object storage, clone/fetch/push,
packing, fsck, and garbage collection wherever the commit itself remains
reachable.

### Relative paths

The human-facing path syntax has two root forms:

```text
~/Alice/coolPythonModule
/<identity>/Alice/coolPythonModule
```

For the Git prototype, `<identity>` should use the same DID/public-key identity
form used by the commit-signature work; the exact textual form is specified by
that identity layer rather than duplicated here.

`~` means "the resolver's current trust root" **only while a path is still
unlocked**. The explicit form names that root directly. After resolution is
locked, the lock's `root` records what `~` meant, so the same source is not
reinterpreted merely because another user, machine, or fork is doing the build.

Resolution is hop-by-hop. Conceptually:

```text
(root, "Alice")
    -> authenticated identity/object for Alice
(Alice, "coolPythonModule")
    -> authenticated named Git history
    -> selected commit
    -> immutable tree/content
```

Every hop is subject to the caller's trust policy. A resolver may use local
indexes, Git refs, signed directories, cached discovery data, or a network
service to discover candidates; those are lookup mechanisms, not part of the
name's identity. The semantic result is an authenticated chain ending in an
immutable hash.

### Heads, forks, and ambiguity

A name may have many commits. Given the commits currently known for one
root/name, a resolver considers ancestry rather than timestamps or arrival
order:

- an ancestor is an older version, not a competing head;
- one maximal descendant is the current unambiguous head;
- several incomparable maximal commits are forks/concurrent heads;
- a merge commit descending from those heads can make the history unambiguous
  again.

A resolver MUST NOT choose among incomparable heads merely by commit time,
lexicographic hash order, network arrival order, or which server answered
first. It either applies an explicit caller trust/policy rule or reports the
ambiguity. A lock removes that ambiguity by naming exact immutable results.

This makes mutable resolution intentionally context-dependent while locked
resolution remains reproducible.

### Lock files

The source/product convention should use one of these filenames:

```text
lock.json
lock.data.js
```

`lock.json` is the JSON encoding; `lock.data.js` is the DataJS encoding. They
represent the same logical lock data and a resolver must not give one different
semantics from the other. The filenames are the future product/source
convention; do not expose `vnd.fjs.lock` as a required filename.

The lock records the immutable answers produced by name resolution. In
particular it has a `root` field in addition to dependency bindings:

```json
{
  "root": "<identity>",
  "lock": {
    "Alice": {
      "coolPythonModule": "<immutable-hash>"
    }
  }
}
```

The exact schema may reuse/evolve the existing recursive lock-map work. The
important semantic distinction is:

- `root` identifies the trust-root context in which relative names were
  resolved;
- leaf bindings identify immutable commit/snapshot/content hashes;
- nested maps preserve scoped choices where the same relative name resolves
  differently in different dependency paths.

A lock is therefore more than a cache. It is the reproducible receipt of a
context-dependent name resolution.

### `lock.root` and forks

**Forking does not change `lock.root`.**

If Bob forks a project whose lock was resolved from Alice's namespace root,
Bob's new commits may be signed by Bob while the copied lock continues to say:

```text
root = Alice
```

and every existing relative dependency keeps resolving exactly as it did in the
source history. The signer authenticates Bob's changes; it does not implicitly
re-root the project's namespace.

This is the critical fork rule. Without it, cloning/forking a project under a
new identity could silently reinterpret every `~/...` dependency and produce a
different program while the source text stayed byte-for-byte identical.

Re-rooting is an explicit operation. A fork that intentionally wants its own
namespace changes/regenerates `lock.root` and re-resolves the symbolic names.
That operation may change many bindings and should be reviewable as such.

The same rule applies when the fork keeps all dependency hashes unchanged:
changing the signer alone is not a reason to rewrite the lock.

### Resolution order

For a path used by a source object, the initial resolver should behave
conceptually as follows:

1. Determine the effective root:
   - an explicit absolute root from the path; otherwise
   - `lock.root` when a lock is present; otherwise
   - the caller's current `~` trust root.
2. Walk the human-readable path under that root, using the caller's trust
   policy to discover authenticated name bindings/candidates.
3. At each dependency scope, prefer an exact applicable lock binding when one
   exists; a locked hash is the answer and is not reinterpreted as another
   mutable name.
4. If no lock binding exists, resolve the mutable named history, requiring an
   unambiguous head or an explicit policy for choosing among forks.
5. Materialize/use the resulting immutable commit/tree/content hash.
6. When producing/updating a lock, write the effective root and every selected
   immutable binding needed to reproduce the result.

The implementation may optimize this heavily; the observable semantics must be
the same.

### Interaction with Git signatures and trusted timestamps

`name` is ordinary commit data. DID signatures (`gpgsig2` in the companion Git
signature prototype), trusted timestamps (`tstsig`), and a final conventional
Git signature therefore cover it exactly as they cover `tree`, `parent`, and
the commit message.

A resolver must distinguish:

- **named by** — the namespace/path under which the commit was discovered;
- **signed by** — identities that authenticated the exact commit;
- **anchored at** — trusted timestamp evidence, if present;
- **locked to** — the immutable hash selected for a dependency.

These can intentionally name different identities. A fork is the common case:
the namespace root can remain Alice, the new commit can be signed by Bob, and
the dependency lock can remain byte-for-byte unchanged.

### Discovery is separate from identity

Git refs are useful indexes for finding named heads, but they are mutable local
transport metadata and MUST NOT define the object identity themselves. An
implementation may publish conventional or custom refs for efficient discovery,
but two stores using different ref layouts must still be able to agree that the
same signed commit is the same named candidate once found.

Likewise, a standard Git fetch only guarantees transfer of objects reachable
from the refs/history it fetches. A custom name or lock reference to an otherwise
unreachable object is not enough to make ordinary Git transfer that object.
The prototype must therefore specify how all locked dependencies remain
reachable/fetchable — for example through explicit refs or a CAS/DISOT fetch
path — without changing the naming semantics above.

### Prototype tasks

- [ ] Specify the exact `name` header grammar and canonical placement in a Git
      commit; reject repeated/malformed names.
- [ ] Build parsing/verification support for `name` without changing normal Git
      commit identity semantics.
- [ ] Define the root identity representation shared with DID signatures.
- [ ] Implement relative-path parsing for `~/...` and explicit-root paths.
- [ ] Implement ancestry-based head detection and explicit ambiguity on
      incomparable forks.
- [ ] Define `lock.json` and `lock.data.js` as two encodings of one logical
      lock schema, including `root` plus recursive immutable bindings.
- [ ] Enforce the fork rule: copying/forking a project preserves `lock.root`;
      changing signer identity alone never re-roots resolution.
- [ ] Add an explicit re-root operation that updates `root` and re-resolves the
      affected names instead of doing so implicitly.
- [ ] Keep locked leaf hashes terminal: do not interpret a locked immutable hash
      as a mutable named history.
- [ ] Specify discovery/fetch mechanics separately from semantic resolution so
      custom Git refs, CAS indexes, or network services can be swapped.
- [ ] Test source-identical forks signed by different DIDs and prove their
      locked dependencies stay identical until an explicit re-root.
- [ ] Test ambiguous same-name forks, a later merge that removes the ambiguity,
      and lock files that deliberately pin either fork.
- [ ] Test stock Git compatibility for commits carrying `name`, including
      clone/fetch/push, pack/unpack, `git fsck`, `git log`, and garbage
      collection of reachable named commits.

### Related

- [DISOT architecture](./plan/architecture.md) — global hashes and
  trust-root-relative human-readable paths.
- [DISOT vision](./plan/vision.md) — the `~/Alice/...` web-of-trust namespace.
- [Evo product materialization](../fjs/cas/evo/todo/product-materialization.md)
  — consumes a resolved dependency graph and must not rewrite source objects.
- [`vnd.fjs.revision`](../fjs/media/revision/README.md) — current revision and
  recursive lock-map model; resolution policy is deliberately outside the
  format.
- [`vnd.fjs.lock`](../fjs/media/lock/README.md) — current shared lock-map blob;
  the future source/product filenames in this design are `lock.json` and
  `lock.data.js`.
- [Git trusted timestamp signatures](./git-trusted-timestamp-signatures.md) —
  companion proposal for DID signatures and trusted timestamps inside standard
  Git commits.
