## SHA-1 → SHA-256 map, kept in a `disot` branch

**Priority:** P2
**Status:** open

### Problem

A trusted timestamp (TTS, RFC 3161) proves that a digest existed at a time
`T`. DISOT (Decentralized Immutable Source of Truth:
[what it is](https://medium.com/@sergeyshandar/digital-space-how-it-should-be-done-4c2f3bd3cf9e),
[architecture](./plan/architecture.md)) wants that proof to be about Git
content — commits, trees, blobs, and the signatures inside them — so that
anyone can show a history existed by `T`, and show *which* history, not one
of a pair. A SHA-1 name cannot carry that proof: a collision gives two
contents one name, so a timestamp over a SHA-1 id proves that one of the
pair existed, and not which
([git-sha1-collisions](./git-sha1-collisions.md)). The digest the timestamp
covers has to be SHA-256 over the content.

Git can name objects by SHA-256, and in practice nothing does: every host,
every clone and every historical repository is SHA-1, and will be for years.
So the content stays SHA-1-named where it lives, and DISOT adds the second
name beside it: a **mapping table** from each SHA-1 object id to a SHA-256
name, carried in the repository on a `disot` branch, each table in a commit
beside a trusted timestamp over the table's own SHA-256. Each such commit
descends from the previous one and its table names the previous one, so
every new timestamp also covers the earlier commits and their timestamps —
a chain that keeps adding timestamps for as long as the repository lives.

The branch is a source of truth in DISOT's sense, and that fixes what it
may hold: **only what was observed, and the original content it was
observed of**. A pair is an observation — these bytes, at hand, hashed to
this name, at this time — and a commit is a set of observations under one
timestamp. The branch records no decisions.

**Scope.** This issue covers one thing: **recording** a timestamp over
hardened hashes — how the pairs are computed, how a commit carries them,
and how the chain grows. What a reader makes of the record — which parties
it trusts, how it ranks two records, what it does with a collision — is
out of scope and listed at the end so that it is not decided by accident.

### Proposal

The table is a **set of pairs** `(sha1, sha256)`, one per Git object, and
every step treats it as a set: nothing is changed or removed, a commit only
adds, and the table in hand is the union, in memory, of every table already
published. Nothing in Git ever merges tables.

Which SHA-256 a pair names is decided in
[git-sha1-collisions](./git-sha1-collisions.md); this process assumes and
recommends **Git's compat name**, the hash of the object converted exactly
as the
[transition document](https://git-scm.com/docs/hash-function-transition.html)
converts it — every embedded SHA-1 id rewritten to its SHA-256 twin, and
whatever it does with a signed commit's signature headers — because under
it the pair for a
commit is a Merkle root over everything the commit reaches, and one
timestamped line proves a whole history. Under the SHA-256 of the stored
bytes, each line proves only its own object, and a history is proved only by
a complete table. The steps below hold under either; where the choice
matters, it is said.

**1. Build the table for the missing commits by walking what they reach.**
A run starts at the commits no earlier table on the chain covers, and
traverses their history — parents, recursively — and, for each commit, its
tree, every subtree, and every blob; an annotated tag reached by a
`mergetag` header or given as a start is an object too. Each object met is
hashed once and its pair recorded. Under compat naming an object's name
depends on the names of what it points to, so a pair is recorded only after
the pairs of everything it references: a post-order walk, which is what a
walk from the leaves up gives anyway.

The walk reads objects with [`fjs/git/store`](../fjs/git/store/module.f.mjs)
and follows them with [`fjs/git/walk`](../fjs/git/walk/module.f.mjs); the
hash is `sha256` from [`fjs/crypto/sha2`](../fjs/crypto/sha2/module.f.mjs),
applied as [`fjs/git/oid`](../fjs/git/oid/module.f.mjs)'s `of` applies a hash
to an object at a width. A tree entry of gitlink mode names a commit of
another repository, whose pair this walk cannot obtain, so a tree holding
one is refused rather than named with a guess; where its pair belongs is
open below.

**2. Add only what the table does not hold.** The table in hand is the
walk's stopping condition: an object whose SHA-1 is already paired is not
hashed again, and nothing it references is visited, as `git fetch` does not
descend below a commit it already has. That pruning is safe only under an
invariant the process guarantees: **the table is closed under
reachability** — if an object is in it, everything the object references
is too. Recording in post-order gives the invariant for free; a table that
violates it is corrupt, refused rather than extended
([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle)). Under
compat naming the invariant is also what makes a pair meaningful, since the
name is defined only where the subgraph below it is named.

What a pruned pair records is exact, and worth stating. A commit's bytes
name its tree and parents by SHA-1, and a tree's bytes name its entries the
same way; under compat naming the commit's pair is those bytes with each
SHA-1 replaced by the name the chain already observed for it. So a run that
prunes at an object records that the new commit reaches *that object as
observed earlier*, by the earlier commit, at the earlier time — not that it
read the object's bytes today. That is the whole of the claim, and it is
right even if the repository now serves the object's colliding twin: the
recorded root names the original, and whoever verifies the twin against the
chain recomputes its name and finds the mismatch. Re-reading and re-hashing
every reached object on every run would make the builder a verifier at the
cost of the full walk each time; that check is a verifier's, out of scope
here, and a tool may offer it as an option. A run computes from bytes it
holds every pair it records, and prunes only at pairs already on the chain
it extends; whether it may prune at pairs another party published is the
trust question below.

So the second run over a repository costs the new commits and the trees and
blobs they introduced, and nothing more; the first run over a large
repository costs every object it holds, once. Under compat naming the
commit roots are what a timestamp proves, and the per-object pairs are the
cache that lets the next run prune at every subtree already named.

**3. Keep the table in Git, on its own branch, with a timestamp over each
delta.** The table lives in the repository it describes, on a branch named
`disot` — `refs/heads/disot`, so that every host and every clone carries it
the way it carries any branch, with no server support and no separate
transport. The branch's history is unrelated to the history it maps: its
first commit has no parent, and its trees hold two files and nothing else:
the delta, and the trusted timestamp over it.

Each commit on the branch carries **only the pairs new since its parents**,
and its parents are the earlier table commits it was built on: the branch is
a Merkle DAG of deltas, and the whole table is never written to Git. The
table of a long-lived repository is huge, and a commit that re-listed it
would make the branch grow with every timestamp; a commit that adds only the
missing commits' objects grows with the content instead, and a commit made
only to renew the timestamps carries only the pairs for what its parent
alone introduced — the parent commit, its tree, its delta and its timestamp
file, which could not be in the parent's own delta. A reader builds the
whole table by
scanning every `disot`
commit and taking the union of their deltas in memory; that union is a
cache, rebuilt from the branch, and a local on-disk form of it is tooling
for later, not part of the format.

The timestamp is a **file beside the delta, not a commit header**. A run
writes the delta, hashes it with SHA-256, requests an RFC 3161 timestamp
with that digest as the imprint, and stores the token it gets back as the
second file; then it commits the two. The digest is the delta's SHA-256
name as a Git blob — the envelope and the bytes, as
[`fjs/git/oid`](../fjs/git/oid/module.f.mjs)'s `of` hashes any object at
the SHA-256 width — so the imprint the token carries is the very name the
next commit's table records for this delta, and a reader compares the two
without a second hash. The stored file is the token
(`TimeStampToken`), not the response that wrapped it, as
[disot-cli-epic](../fjs/todo/disot-cli-epic.md) already asks.

So the proof never touches SHA-1: token, imprint, delta, pairs, names, all
SHA-256, and a reader that has the delta and the token verifies without
the commit. The commit is ordinary and plain — no signature, no extra
header, nothing in it a reader relies on — and is only Git's way of
carrying two files and naming the tables they were built on. The commit
headers that
[git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
puts a timestamp in are for the commits of the mapped history; this branch
does not use them, and shares only the RFC 3161 request and token handling.

**4. Take every published table before publishing one.** Before a run
records anything, it fetches `disot` from every remote it publishes to,
scans every commit reachable from the heads it fetched, and takes the union
of their deltas, in memory, as the table in hand for step 2. Then the walk
records only pairs absent from that union, the run writes them as one new
commit whose parents are the heads it fetched — one parent in the usual
case, several when two publishers raced — and pushes. Two writers who each
fetched the same head and each pushed produce two heads, and the next commit
simply names both as parents: nothing is merged, since the next delta only
adds and a reader's union sees both. Two such writers may each have
recorded the same pair, since neither saw the other's commit; that is
normal, and a pair's timestamp is then the oldest of the deltas holding it.
If the union holds two different SHA-256 names for one SHA-1, the run has
no name to build on and refuses to publish; what to do then is out of
scope below.

Each new table also holds the pairs for the table commit it descends from
and for the tree, the delta and the timestamp file that commit introduced —
existing objects like any other, and the closure invariant demands them;
under compat naming the parent commit's line then binds the whole earlier
chain by SHA-256, and the line for the parent's delta repeats the very
digest the parent's token carries.

### What a timestamp proves

- **Existence, of named content, by a time.** A pair's timestamp is the
  TTS of the commit that first introduced it. It proves that content with
  that SHA-256 name existed by the token's time plus its declared accuracy,
  the conservative bound the companion design uses, and the proof is the timestamp
  plus the objects: whoever checks it recomputes the name from the bytes
  and compares. The **oldest** timestamp naming the content is the whole
  proof of when it existed; later ones add nothing to that bound. The
  token reaches the pair directly, through the delta's SHA-256 name, so the
  bound is the introducing commit's own time.
- **Why the chain keeps adding timestamps anyway.** A timestamp verifies
  only while its authority's certificate chain does, and a newer timestamp
  over the chain proves the older token existed before that chain expired
  or its key was compromised — the renewal RFC 3161 and long-term
  validation describe — provided the renewal's own bound precedes that
  expiry or compromise; a renewal made after it proves only its own time,
  and a reader does not report the older proof as preserved by it. So a
  renewal-only commit is a normal commit, made in time.
- **The imprint is the delta's SHA-256 name.** A request that hashed the
  commit's SHA-1 id, or the delta with SHA-1, would bind a name the
  attacker can collide, and the record would prove nothing more than the
  SHA-1 did. The digest is fixed here, by this process; what digest the
  companion design's commit headers use is that design's open item.

### Open questions

Each is decided in the format or the tool that needs it, not here; this
list is so that none is decided by accident.

- **Which SHA-256.** [git-sha1-collisions](./git-sha1-collisions.md)'s
  question; this process assumes the compat name and says why above.
- **A local index.** A delta per commit is decided, and a delta is one
  file, since the token's imprint is that file's blob name: a pair lives
  in the deltas that introduced it, usually one, so its time is the oldest
  of their timestamps with nothing to look up. What is open is whether a
  reader that answers one SHA-1 without scanning the whole branch is worth
  a local index, which is tooling and not format.
- **The line format of a pair.** `<sha1> SP <sha256> LF`, sorted by SHA-1
  as `packed-refs` is sorted, is the least a reader needs and the format Git
  already parses in its compat index; or a `.disot.*` DataJS document beside
  the other DISOT metadata, which reads with the readers the name-resolution
  work already needs. Whichever, sorted and refused when unsorted, so lookup
  is a search that fails rather than answers wrongly, as
  [`fjs/git/packidx`](../fjs/git/packidx/module.f.mjs) does for its ids.
  And whichever, strict: a reader refuses a delta the tool would not have
  written, rather than reading past what it does not understand.
- **The two file names, and the token's encoding.** The delta and the
  token need names in the tree, and the token is DER; whether it is stored
  as the raw `TimeStampToken` bytes or wrapped so that the file says what
  it is. Both are the format's to decide.
- **Gitlinks.** A submodule's commit is an object of another repository. Its
  pair belongs to that repository's own `disot` branch, so the natural rule
  is: not followed, not recorded, and a reader that needs it asks the
  submodule. Open whether the table should at least name the boundary.
- **Shallow and partial clones.** A walk that cannot reach the bottom cannot
  establish the closure invariant, so a run over such a clone refuses to
  publish rather than publishing a partial table. Whether it may publish
  pairs for the objects it does hold, marked as unclosed, is open.
- **Tags.** An annotated tag reached only through a ref is outside a
  commit's reachability. Whether the walk starts from refs or from commits
  decides whether tags are inputs.
- **The branch name.** `disot` is a name people will type and hosts will
  show; a ref outside `refs/heads/` would hide it from branch listings and
  from `git clone`'s default fetch. The visible branch is proposed because it
  needs no configuration on any side; open whether a refspec is worth the
  hiding.

### Out of scope

Reading the record is a separate design. These were discussed while this
one was written and are kept here only so they are not lost or decided by
accident:

- **Trust between parties.** Which publishers' tables a reader accepts, and
  whether a run may prune at pairs another party published. A timestamp
  orders claims and a signature attributes them, so a reader ranks records
  by signer before it ranks them by time. This record authenticates only
  the timestamp authority: the commit is unsigned and its author line is
  a claim, so attribution needs a record of its own.
- **Two records for one SHA-1.** Among trusted records, the earliest first;
  two different SHA-256 names for one SHA-1 is a collision, always reported,
  with the oldest pair as the working default on the assumption that a later
  one passes a twin off under a known name. The branch records both
  observations and no decision. A proper resolution may need consensus and
  signatures from many parties, and its records are a later layer.
- **Suppression.** A timestamp proves existence, not priority; an attacker
  who controls the only copy of the branch can drop the honest commit, and
  the defenses — a reader refusing a head that does not descend by SHA-256
  from a table it holds, and publication to more than one host — are the
  reader's and the publisher's, not the record's.
- **A miss.** What a reader does with an object no table holds.

### Tasks

- [ ] Define the table file format and its tree layout, as a `todo/` beside
      the module that will read it, with the open questions above answered.
- [ ] The timestamp: the request with the delta's SHA-256 name as the
      imprint, the token checked against it and stored, reusing the
      RFC 3161 handling
      [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
      defines.
- [ ] The walk: from the missing commits and a table in hand to the pairs it
      lacks, pruning at what is held and recording in post-order, over
      [`fjs/git/store`](../fjs/git/store/module.f.mjs) and
      [`fjs/git/walk`](../fjs/git/walk/module.f.mjs); a proof against a
      fixture repository that the second run over an unchanged repository
      records nothing.
- [ ] Reading the table: the in-memory union from a scan of every `disot`
      commit, and the closure check that refuses a table an object of which
      references an unmapped one.
- [ ] Writing the table: the delta and the token as blobs, their tree, and
      the commit with the fetched heads as parents. Nothing in [`fjs/git`](../fjs/git/README.md)
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
  — the RFC 3161 request and token handling this reuses; its commit headers
  are for the mapped history's commits, not this branch's.
- [git-name-resolution](./git-name-resolution.md) — the other DISOT
  metadata, and the `.disot.*` files a table format might join.
- [disot-cli-epic](../fjs/todo/disot-cli-epic.md) — where the command
  lands.
- [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md) — collision
  detection for the SHA-1 side of each pair.
- [Git hash-function transition](https://git-scm.com/docs/hash-function-transition.html)
  — the compat mapping and the index formats Git keeps it in.
- [Digital space: how it should be done](https://medium.com/@sergeyshandar/digital-space-how-it-should-be-done-4c2f3bd3cf9e)
  — what DISOT is, and why a source of truth holds only what was observed.
