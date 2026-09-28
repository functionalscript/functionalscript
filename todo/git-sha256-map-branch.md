## SHA-1 → SHA-256 map, kept in a `disot` branch

**Priority:** P2
**Status:** open

### Problem

A trusted timestamp (TTS, RFC 3161) proves that a digest existed at a time
`T`. DISOT wants that proof to be about Git content — commits, trees, blobs,
and the signatures inside them — so that anyone can show a history existed
by `T`, and show *which* history, not one of a pair. A SHA-1 name cannot
carry that proof: a collision gives two contents one name, so a timestamp
over a SHA-1 id proves that one of the pair existed, and not which
([git-sha1-collisions](./git-sha1-collisions.md)). The digest the timestamp
covers has to be SHA-256 over the content.

Git can name objects by SHA-256, and in practice nothing does: every host,
every clone and every historical repository is SHA-1, and will be for years.
So the content stays SHA-1-named where it lives, and DISOT adds the second
name beside it: a **mapping table** from each SHA-1 object id to a SHA-256
name, carried in the repository on a `disot` branch, in commits that are
signed and timestamped. Each such commit descends from the previous one, so
every new timestamp also covers the earlier commits and their timestamps —
a chain that keeps adding timestamps for as long as the repository lives.

That is the per-repository answer to the collisions issue's second
candidate, and it is a process before it is a format: how the table is
built, how it grows, how tables from several parties merge, and what a
verifier trusts. This issue is the process. The formats and the tooling
come after it, one pull request at a time.

### Proposal

The table is a **set of pairs** `(sha1, sha256)`, one per Git object, and
every step treats it as a set: nothing is changed or removed, a merge is a
union, and the table in hand is the union of every table already published.
Which SHA-256 a pair names is decided in
[git-sha1-collisions](./git-sha1-collisions.md); this process assumes and
recommends **Git's compat name**, the hash of the object with every embedded
SHA-1 id rewritten to its SHA-256 twin, because under it the pair for a
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
another repository and is not followed; where its pair belongs is open
below.

**2. Add only what the table does not hold, and only trust what is
trusted.** The table in hand is the walk's stopping condition: an object
whose SHA-1 is already paired is not hashed again, and nothing it references
is visited, as `git fetch` does not descend below a commit it already has.
That pruning is safe only under an invariant the process guarantees: **the
table is closed under reachability** — if an object is in it, everything
the object references is too. Recording in post-order gives the invariant
for free; a table that violates it is corrupt, refused rather than extended
([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle)). Under
compat naming the invariant is also what makes a pair meaningful, since the
name is defined only where the subgraph below it is named.

Pruning is a builder's shortcut and never a verifier's. A verifier reads the
object and recomputes, every time, since a swapped twin has the SHA-1 the
table holds and is exactly what a prune walks past. And a run prunes only at
a pair it trusts — from its own earlier runs, or from a table commit whose
signer it trusts — because a pair from anyone else may be an attacker's,
published early so that the honest run skips the object (see **Trust**). A
pair for an object entering the repository is therefore computed by whoever
accepts it, at acceptance, from the bytes as accepted, never taken from a
table.

So the second run over a repository costs the new commits and the trees and
blobs they introduced, and nothing more; the first run over a large
repository costs every object it holds, once. The per-object pairs are what
keep runs incremental. Trust flows from the commit roots; the object pairs
are the cache that lets the next run prune at every subtree already named,
and each is checkable against a root.

**3. Keep the table in Git, on its own branch, in signed and timestamped
commits.** The table lives in the repository it describes, on a branch named
`disot` — `refs/heads/disot`, so that every host and every clone carries it
the way it carries any branch, with no server support and no separate
transport. The branch's history is unrelated to the history it maps: its
first commit has no parent, and its trees hold table files and nothing else.

A commit on `disot` is an ordinary commit, signed and timestamped the way
[git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
signs one. The table files carry no signature of their own; they are data,
and everything a verifier trusts about them it gets from the commit. In a
SHA-1 repository the commit's `tree` header reaches those files only by
SHA-1, and two things bind them by SHA-256 instead. The next commit's table
holds the pair for this commit, which under compat naming is a root over
this commit's tree, table, signatures and timestamp — so every table but the
newest is bound by SHA-256 through its successor's timestamp, one commit
late. And, optionally, a header in the signed payload naming the tree by
SHA-256, which binds the newest table at its own timestamp rather than the
next one's; the collisions issue's third candidate, defined once for this
branch and for any signed commit later. The header is the tight bound; the
chain is the bound without it. With a strict table format neither is needed
against the attacks known today — an attacker who authors none of the table's
bytes cannot collide it — and both are kept so that the verifier's chain from
the timestamp to every pair is SHA-256 end to end, with no per-format
argument to maintain.

**4. Take every published table before publishing one.** Before a run
records anything, it fetches `disot` from every remote it publishes to,
reads that branch, and takes the union of the tables it finds as the table
in hand for step 2. Then the walk records only pairs absent from that union,
the run writes them as one new commit whose parents are the branch heads it
fetched — one parent in the usual case, several when two publishers raced —
and pushes. Two writers who each fetched the same head and each pushed
produce two heads, and the next run merges them by union with no conflict to
resolve, because the table is a set and a merge never chooses between pairs.
So the branch never carries a pair twice, and a commit carries only what its
author computed.

Each new table also holds the pair for the table commit it descends from,
since that commit is an existing object. A reader who holds an older table
then checks that the head it fetched descends from it by SHA-256 name, not
by the SHA-1 in `parent`, and refuses a head that does not (see **Trust**).

### Trust

What a verifier trusts, and what it does not, once every table commit is
signed and timestamped:

- **What one timestamp proves.** A pair's timestamp is the TTS of the commit
  that first introduced it. It proves that content with that SHA-256 name
  existed by that time, and the proof is the timestamp plus the objects: a
  verifier recomputes the name from the bytes it holds and checks it against
  the line. The **oldest** trusted timestamp naming the content is the whole
  proof of when it existed; later ones add nothing to that bound. They are
  kept for a different reason: a timestamp verifies only while its
  authority's certificate chain does, and a newer timestamp over the chain
  proves the older token existed before that chain expired or its key was
  compromised, which is the renewal RFC 3161 and long-term validation
  describe.
- **A timestamp orders claims; a signature attributes them.** The known
  attacks need the attacker to author both twins before contributing one, so
  a pair computed and timestamped at acceptance pins which twin the
  repository held, and a table the attacker publishes afterwards carries a
  later time. But an attacker who can publish tables can also be first:
  contribute object X, timestamp a pair naming twin B while the repository
  holds twin A, and swap later. So a verifier ranks pairs for one SHA-1 by
  whether it trusts their signer before it ranks them by time, and a run
  prunes only at pairs it trusts, as step 2 says.
- **Tables from trusted parties merge earliest first.** Where two trusted
  tables pair one SHA-1 with the same SHA-256, the older record stands and
  the newer adds nothing. Where they pair it with **two different SHA-256
  names, that is a collision**, and the verifier **reports it**, always. By
  default it then answers with the **oldest** pair, on the assumption that
  the later one is an attempt to pass a twin off under a name already known;
  a strict verifier may refuse the object instead, since among honest
  parties two names for one SHA-1 can only mean a real collision, and a
  compromised trusted party who published first would win the default. The
  union in step 4 keeps both lines, so the report has its evidence and the
  choice is the verifier's, not the merge's.
- **The timestamp's imprint is SHA-256 over the commit's bytes.** A request
  that hashes the commit's SHA-1 id, or the payload with SHA-1, binds a name
  the attacker can collide. The digest the timestamp contract names is an
  open item of [git-sha1-collisions](./git-sha1-collisions.md); this process
  requires it to be SHA-256.
- **A timestamp proves existence, not priority.** It says the older table
  existed by its time; it cannot say that no other table existed before the
  attacker's. So "earliest first" holds only for a verifier that can see the
  earlier table, and an attacker who controls the only copy of the branch
  force-pushes it without the honest commit. The chain in step 4 lets anyone
  holding an older table refuse a head that does not descend from it; wide
  publication, to more than one host, is the defense for everyone else, as
  it is for any Git history.

### Open questions

Each is decided in the format or the tool that needs it, not here; this
list is so that none is decided by accident.

- **Which SHA-256.** [git-sha1-collisions](./git-sha1-collisions.md)'s
  question; this process assumes the compat name and says why above.
- **Delta per commit, or sharded snapshot.** A delta per commit makes
  answering one SHA-1 a walk over the branch's whole history unless a reader
  builds a local index first. A snapshot fanned out by the SHA-1's leading
  byte, one file per shard, answers one id by a tree walk to one file, and
  costs each commit only the shards it changed, since Git's tree sharing
  stores an untouched shard once; step 4's "read every table" then collapses
  to "read the head's tree". That layout is a Git notes tree, and
  `refs/notes/` would give the fan-out, the lookup and a union merge for
  free, at the cost of a ref hosts do not show and clones do not fetch by
  default. Against the snapshot: **Trust** needs a time per pair, the
  timestamp of the commit that first introduced it, and a delta gives that
  for free because a pair lives in exactly one delta, where a snapshot
  needs a per-line time or a history walk to find the introducing commit.
  Either way the union of a shard is the tool's, not Git's text merge.
- **The line format of a pair.** `<sha1> SP <sha256> LF`, sorted by SHA-1
  as `packed-refs` is sorted, is the least a reader needs and the format Git
  already parses in its compat index; or a `.disot.*` DataJS document beside
  the other DISOT metadata, which reads with the readers the name-resolution
  work already needs. Whichever, sorted and refused when unsorted, so lookup
  is a search that fails rather than answers wrongly, as
  [`fjs/git/packidx`](../fjs/git/packidx/module.f.mjs) does for its ids.
  And whichever, strict: a format that admits bytes the tool did not write
  hands an attacker the control over the table's bytes that step 3's
  argument says they lack.
- **Gitlinks.** A submodule's commit is an object of another repository. Its
  pair belongs to that repository's own `disot` branch, so the natural rule
  is: not followed, not recorded, and a verifier that needs it asks the
  submodule. Open whether the table should at least name the boundary.
- **Shallow and partial clones.** A walk that cannot reach the bottom cannot
  establish the closure invariant, so a run over such a clone refuses to
  publish rather than publishing a partial table. Whether it may publish
  pairs for the objects it does hold, marked as unclosed, is open.
- **Tags.** An annotated tag reached only through a ref is outside a
  commit's reachability. Whether the walk starts from refs or from commits
  decides whether tags are inputs.
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

- [ ] Define the table file format and its tree layout, delta or snapshot,
      as a `todo/` beside the module that will read it, with the open
      questions above answered.
- [ ] Define the SHA-256 tree header in the signed payload, in
      [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md),
      and require SHA-256 as the timestamp's imprint digest there.
- [ ] The walk: from the missing commits and a table in hand to the pairs it
      lacks, pruning at trusted pairs and recording in post-order, over
      [`fjs/git/store`](../fjs/git/store/module.f.mjs) and
      [`fjs/git/walk`](../fjs/git/walk/module.f.mjs); a proof against a
      fixture repository that the second run over an unchanged repository
      records nothing.
- [ ] Reading the table: the union over the `disot` branch, the closure
      check that refuses a table an object of which references an unmapped
      one, the descent check against a table already held, and the
      earliest-first rule with its collision report.
- [ ] Writing the table: the pairs as a blob, its tree, and the commit with
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
  — what signs and timestamps a commit on the `disot` branch, and where the
  SHA-256 tree header and the imprint digest are defined.
- [git-name-resolution](./git-name-resolution.md) — the other DISOT
  metadata, and the `.disot.*` files a table format might join.
- [disot-cli-epic](../fjs/todo/disot-cli-epic.md) — where the command
  lands.
- [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md) — collision
  detection for the SHA-1 side of each pair.
- [Git hash-function transition](https://git-scm.com/docs/hash-function-transition.html)
  — the compat mapping and the index formats Git keeps it in.
