## SHA-1 → SHA-256 map, kept in a `disot` branch

**Priority:** P2
**Status:** open

### Problem

[git-sha1-collisions](./git-sha1-collisions.md) names, as its second
candidate, a table from every SHA-1 object id to a SHA-256 name, and asks
who vouches for it. One of its three answers is **per repository**: the table
travels in the repository it describes, as a ref, covered by the same
signatures and timestamps as the history. That answer is a process before it
is a format — how the table is built, how it grows, how it is shared — and
until the process is written down nothing can decide what the files look like
or what tool writes them. This issue is that process. The formats and the
tooling come after it, one pull request at a time.

### Proposal

The table is a set of pairs `(sha1, sha256)`, one per Git object, and every
step below treats it as a set: nothing is ever changed or removed, a merge is
a union, and the table in hand is always the union of every table already
published.

**1. Build the table for a commit by walking what it reaches.** Start at a
commit and traverse its history — parents, recursively — and, for each
commit, its tree, every subtree, and every blob; an annotated tag reached by a
`mergetag` header or given as the start is an object too. Each object met is
hashed once with SHA-256 and the pair is recorded. Which SHA-256 is recorded
is the open choice in [git-sha1-collisions](./git-sha1-collisions.md): the
SHA-256 of the object's stored bytes, or Git's own compat name, the hash of
the object with every embedded SHA-1 id rewritten to its SHA-256 twin. The
walk is the same for both, with one difference in order: the compat name of a
tree, a commit or a tag depends on the names of what it points to, so under
that choice an object's pair is recorded only after the pairs of everything it
references — a post-order walk, which is what a walk from the leaves up gives
anyway. Writing the process so that it holds under either choice keeps the
choice open without blocking this one.

The walk reads objects with [`fjs/git/store`](../fjs/git/store/module.f.mjs)
and follows them with [`fjs/git/walk`](../fjs/git/walk/module.f.mjs); the
hash is `sha256` from [`fjs/crypto/sha2`](../fjs/crypto/sha2/module.f.mjs),
applied as [`fjs/git/oid`](../fjs/git/oid/module.f.mjs)'s `of` applies a hash
to an object at a width. A tree entry of gitlink mode names a commit of
another repository and is not followed; whether its pair belongs in this
table, in the submodule's own, or nowhere is open below.

**2. Add only what the table does not hold.** The table already in hand is
the walk's stopping condition: an object whose SHA-1 is already mapped is not
hashed again, and nothing it references is visited, just as `git fetch` does
not descend below a commit it already has. That pruning is only safe under
one invariant, which the process therefore guarantees: **the table is closed
under reachability** — if an object is in the table, everything it references
is too. Recording a pair only after the pairs of what it references (the
post-order above) gives the invariant for free; a table that violates it is a
corrupt table, refused rather than extended
([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle)). The
invariant is also what makes a pair meaningful under the compat choice, since
that name is defined only where the subgraph below it is named.

So the second run over a repository costs the new commits and the trees and
blobs they introduced, and nothing more; the first run over a large repository
costs every object it holds, once.

**3. Keep the table in Git, on its own branch.** The table lives in the
repository it describes, on a branch named `disot` — `refs/heads/disot`, a
name chosen so that every host and every clone carries it the way it carries
any branch, with no server support and no separate transport. The branch's
history is unrelated to the history it maps: its first commit has no parent,
and its trees hold table files and nothing else. A commit on `disot` is an
ordinary commit — signed and timestamped the way
[git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
signs one, when that lands — so the per-repository answer to "who vouches"
is: whoever signed the table commit, at the time the timestamp proves.

Each commit on the branch carries **only the pairs new since its parents**: a
delta, not a snapshot. The whole table is the union of the deltas over the
branch's history. A snapshot per commit would re-store a file that grows with
the repository at every run and would make a merge of two snapshots a
three-way merge of one large file; deltas keep each commit the size of what
changed and make a merge a commit whose delta is empty, or holds only what
neither parent had. The mapping is a cache of a deterministic function of the
object's bytes, so any pair can be checked by anyone who has the object; the
signature on the commit says who computed it and when, not that it is right.

**4. Take every published table before publishing one.** Before a run
records anything, it fetches `disot` from every remote it publishes to,
walks that branch's history, and takes the union of the deltas it finds as
the table in hand for step 2. Then the walk records only pairs absent from
that union, the run writes them as one new commit whose parents are the
branch heads it fetched — one parent in the usual case, several when two
publishers raced — and pushes. Two writers who each fetched the same head and
each pushed produce two heads, and the next run merges them by union with
no conflict to resolve, because the table is a set. So the branch never
carries a pair twice, and the pull request that publishes it carries only
what its author computed.

### Open questions

Each is decided in the format or the tool that needs it, not here; this
list is so that none is decided by accident.

- **Which SHA-256**, stored bytes or Git's compat name, is
  [git-sha1-collisions](./git-sha1-collisions.md)'s question and stays
  there. The compat name is what Git's own transition will publish and
  closes the hole the plain hash leaves in a tree naming a colliding blob;
  it costs the post-order the process already has.
- **The file layout of a delta.** One file per commit, named for nothing in
  particular since the commit is the key; or files sharded by the SHA-1's
  leading byte, as `objects/` is, so that a large delta splits and Git's tree
  sharing does the rest. The choice decides whether a reader needs the whole
  history to answer one id, or only the shards that could hold it.
- **The line format of a pair.** `<sha1> SP <sha256> LF`, sorted by SHA-1
  as `packed-refs` is sorted, is the least a reader needs and the format Git
  already parses in its compat index; or a `.disot.*` DataJS document beside
  the other DISOT metadata, which reads with the readers the name-resolution
  work already needs. Whichever, sorted and refused when unsorted, so lookup
  is a search that fails rather than answers wrongly, as
  [`fjs/git/packidx`](../fjs/git/packidx/module.f.mjs) does for its ids.
- **Gitlinks.** A submodule's commit is an object of another repository. Its
  pair belongs to that repository's own `disot` branch, so the natural rule
  is: not followed, not recorded, and a verifier that needs it asks the
  submodule. Open whether the table should at least name the boundary.
- **What a verifier does with a miss.** An object the table does not hold is
  either newer than the last run or was never published; the process makes
  the two indistinguishable, and the verifier's answer — compute and
  compare, refuse, or report unverified — is the policy issue's.
- **The branch name.** `disot` is a name people will type and hosts will
  show; a ref outside `refs/heads/` would hide it from branch listings and
  from `git clone`'s default fetch. The visible branch is proposed because it
  needs no configuration on any side; open whether a refspec is worth the
  hiding.

### Tasks

- [ ] Define the delta file format and its tree layout, as a `todo/` beside
      the module that will read it, with the two open questions above
      answered.
- [ ] The walk: from a commit and a table in hand to the pairs it lacks,
      pruning at what is held and recording in post-order, over
      [`fjs/git/store`](../fjs/git/store/module.f.mjs) and
      [`fjs/git/walk`](../fjs/git/walk/module.f.mjs); a proof against a
      fixture repository that the second run over an unchanged repository
      records nothing.
- [ ] Reading the table: the union of the deltas over the `disot` branch's
      history, and the closure check that refuses a table an object of which
      references an unmapped one.
- [ ] Writing the table: the delta as a blob, its tree, and the commit with
      the fetched heads as parents. Nothing in [`fjs/git`](../fjs/git/README.md)
      writes an object to a store yet — the effects have `inflate` and no
      `deflate`, and [`fjs/git/loose`](../fjs/git/loose/module.f.mjs) only
      reads — so a loose-object writer comes first, then the branch tip
      through [`fjs/git/refstore/write`](../fjs/git/refstore/write/module.f.mjs)'s
      `tryWrite`.
- [ ] The command, under [disot-cli-epic](../fjs/todo/disot-cli-epic.md)'s
      surface: fetch, read, walk, write, push, in that order, refusing to
      publish over a head it did not fetch.

### Related

- [git-sha1-collisions](./git-sha1-collisions.md) — the policy this is one
  answer to, and the choice of which SHA-256 it records.
- [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
  — what signs and timestamps a commit on the `disot` branch.
- [git-name-resolution](./git-name-resolution.md) — the other DISOT
  metadata, and the `.disot.*` files a table format might join.
- [disot-cli-epic](../fjs/todo/disot-cli-epic.md) — where the command
  lands.
- [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md) — collision
  detection for the SHA-1 side of each pair.
- [Git hash-function transition](https://git-scm.com/docs/hash-function-transition.html)
  — the compat mapping and the index formats Git keeps it in.
