## SHA-1 → SHA-256 map, kept in a `disot` branch

**Priority:** P2
**Status:** open

### Problem

A trusted timestamp (TTS, RFC 3161) proves that a digest existed at a time.
DISOT (Decentralized Immutable Source of Truth:
[what it is](https://medium.com/@sergeyshandar/digital-space-how-it-should-be-done-4c2f3bd3cf9e),
[architecture](./plan/architecture.md)) wants that proof to be about Git
content, and to name *which* content, not one of a colliding pair. A SHA-1
name cannot do that ([git-sha1-collisions](./git-sha1-collisions.md)); the
digest has to be SHA-256 over the content.

Git can name objects by SHA-256, and in practice nothing does: every host,
every clone and every old repository is SHA-1. So the content stays where it
is, and DISOT adds the second name beside it: a **mapping table** from SHA-1
object id to SHA-256 name, kept on a `disot` branch, each delta in a commit
beside a trusted timestamp over the delta's own SHA-256. Each commit
descends from the previous one, so the chain keeps adding timestamps for as
long as the repository lives.

The branch holds **only what was observed**: a pair is an observation, a
commit is a set of observations under one timestamp, and the branch records
no decisions.

**Scope.** Recording only: how pairs are computed, how a commit carries
them, how the chain grows. Reading the record — trusting a party, ranking
two records, resolving a collision, verifying a branch — is out of scope
and listed at the end.

### Proposal

The table is a **set of pairs** `(sha1, sha256)`, one per object. A commit
only adds; nothing in Git merges tables; the table in hand is the union, in
memory, of every delta on the branch.

Which SHA-256 a pair names is [git-sha1-collisions](./git-sha1-collisions.md)'s
decision. This process assumes **Git's compat name**, the object converted
as the [transition document](https://git-scm.com/docs/hash-function-transition.html)
converts it, because then a commit's pair is a Merkle root over everything
it reaches, and one timestamped line proves a whole history.

1. **Walk.** Start at the commits no delta covers yet. Traverse parents,
   trees and blobs in post-order, since under compat naming an object's
   name depends on the names of what it references. Record a pair for
   every object met. A tree with a gitlink is refused: the submodule
   commit's pair is not this repository's to compute.
2. **Prune at the table.** An object already paired is not hashed again and
   nothing below it is visited. That is safe because the table is **closed
   under reachability**: post-order recording puts every referenced object
   in before the object that references it. A pruned pair records that the
   new commit reaches the object *as observed earlier*, not that its bytes
   were read today; re-reading them is a verifier's job. So a run costs
   the new content, and the first run over a large repository costs every
   object it holds, once.
3. **One delta and one timestamp per commit.** The branch is
   `refs/heads/disot`, so every host and clone carries it with no
   configuration. Its history is unrelated to the mapped history. Each
   commit's tree holds two files: the delta, the pairs new since the
   parent; and the record, the delta's SHA-256 blob name beside the RFC
   3161 token whose imprint is that name. The tree entry gives the delta's
   SHA-1, the record its SHA-256, so the commit pairs its own delta without
   the delta naming itself. The commit is plain: no signature, no header.
   The next delta records the parent commit, its tree and its record, which
   the parent could not name; the delta was paired by the record.
4. **A run over a covered repository still commits.** Its delta holds the
   parent's own three objects and its token renews the chain. A renewal is
   not a no-op.

### The command: `fjs tts`

One command, one option, `--tsa <url>`, run inside a repository. It reads
committed objects and writes objects and one ref. It never touches the
index or the working tree, so a dirty tree is not checked. It refuses a
`disot` checked out in any worktree, as `git branch -f` would, and a
SHA-256 repository, whose content already has the name.

1. **Read the cache.** Scan `refs/heads/disot`, if it exists, and take the
   union of its deltas in memory, plus one pair per commit for its delta:
   the tree entry's SHA-1, the record's SHA-256. Each delta is hashed as a
   blob at the SHA-256 width and must equal its record, so a damaged blob
   does not feed the cache. Two names for one SHA-1 refuse the run. No
   branch, empty cache, no parent. Remote-tracking heads are not read:
   pruning at another party's pairs is trusting them. A user who trusts
   a remote's `disot` makes it their own branch first.
2. **Walk** from `HEAD`, and from the `disot` head, whose commit, tree and
   record no delta holds yet, recording what the cache lacks.
3. **Write the delta**, `sha1-sha256-map.json`: one JSON object, SHA-1 keys
   in lowercase hex in ascending order, SHA-256 values in lowercase hex,
   no whitespace, no escapes. One set of pairs, one byte sequence; a reader
   refuses any other spelling.
4. **Timestamp it.** Request an RFC 3161 timestamp with the delta's SHA-256
   blob name as imprint, a fresh nonce and `certReq` set. Check the
   response's status, imprint, nonce, signature and the signer's
   certificate chain, as [disot-cli-epic](../fjs/todo/disot-cli-epic.md)
   asks. Any failure ends the run with nothing written. Write the record,
   `tts.json`: `{"sha256":"…","tts":"…"}`, the token as DER in standard
   base64, no whitespace, no escapes.
5. **Commit** the two blobs and their tree, with the `disot` head as the
   one parent, and move `refs/heads/disot` only if it still holds what
   step 1 read. Nothing is fetched or pushed; both are the user's.

### What a timestamp proves

- **Existence by a time.** The token's time plus its accuracy, from the
  token or its TSA policy, is the bound; a token with neither gives its
  time and claims no bound. The proof is the token plus the objects: a
  reader recomputes the name from the bytes and compares. The earliest
  bound naming the content is the whole proof; later tokens add nothing to
  it.
- **Why the chain keeps adding timestamps.** A token verifies only while
  its authority's certificate does. A later token over the chain proves
  the earlier one existed before that, if the later bound precedes the
  expiry. That is the renewal RFC 3161 describes.
- **The imprint is the delta's SHA-256 name.** Hashing anything by SHA-1
  would bind a name an attacker can collide.

### Open questions

- **Which SHA-256**: the collisions issue's; compat naming assumed here.
- **Joining raced heads.** Two publishers who raced produce two heads.
  The command writes one parent and `git branch -f` replaces rather than
  joins; how a user names a second trusted head is a later version's.
- **Gitlinks.** A submodule's pair belongs to its own `disot` branch.
  Whether the table should name the boundary is open.
- **Shallow clones.** A walk that cannot reach the bottom cannot close the
  table, so it refuses. Whether it may publish an unclosed part is open.
- **Tags** reached only through refs, and **a local index** for lookup
  without a scan, are tooling questions.

### Out of scope

Reading the record is a separate design, kept here only so it is not
decided by accident:

- **Verifying a branch.** The command reads its own branch as it finds it.
  Checking tokens against their authorities at the time a renewal proves,
  detecting a substituted twin, checking closure: a verifier's, and a
  later command's. Closure is the writer's guarantee; checking it costs
  the full walk the table exists to avoid.
- **Trust between parties.** Which publishers' tables a reader accepts. The
  record authenticates only the timestamp authority; the commit is
  unsigned and its author line is a claim.
- **Two records for one SHA-1.** A collision, always reported; the oldest
  pair as the working default. Resolution may need many parties'
  signatures, a later layer.
- **Suppression** of the honest head by whoever holds the only copy, and
  **a miss**, an object no table holds.

### Tasks

- [ ] The delta and record readers and writers, canonical and refused when
      not.
- [ ] The timestamp request and check, reusing the RFC 3161 handling
      [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
      defines.
- [ ] The walk over [`fjs/git/store`](../fjs/git/store/module.f.mjs) and
      [`fjs/git/walk`](../fjs/git/walk/module.f.mjs), with a proof that a
      second run over an unchanged repository records only the renewal.
- [ ] A loose-object writer: nothing in [`fjs/git`](../fjs/git/README.md)
      writes an object yet, and the effects have `inflate` and no
      `deflate`. Then the branch tip as a compare-and-swap, which
      [`fjs/git/refstore/write`](../fjs/git/refstore/write/module.f.mjs)'s
      `tryWrite` does not do.
- [ ] `fjs tts`: read, walk, write, timestamp, commit.

### Related

- [git-sha1-collisions](./git-sha1-collisions.md) — the policy this
  answers, and which SHA-256 a pair names.
- [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
  — the RFC 3161 handling this reuses; its commit headers are not used here.
- [git-name-resolution](./git-name-resolution.md) — the other DISOT
  metadata.
- [disot-cli-epic](../fjs/todo/disot-cli-epic.md) — where the command lands.
- [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md) — collision
  detection for the SHA-1 side.
- [Git hash-function transition](https://git-scm.com/docs/hash-function-transition.html)
  — the compat naming.
