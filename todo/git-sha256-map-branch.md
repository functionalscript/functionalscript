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
digest has to be SHA-256 over the content. Git can name objects by SHA-256,
and in practice every host, clone and old repository is SHA-1.

So the content stays where it is, and DISOT adds the second name beside it:
a **mapping table** from SHA-1 object id to SHA-256 name, kept on a `disot`
branch, each delta in a commit beside a trusted timestamp over the delta's
own SHA-256. Each commit descends from the previous one, so the chain keeps
adding timestamps for as long as the repository lives. The branch holds
only what was observed and records no decisions.

### Design

- The table is a **set of pairs** `(sha1, sha256)`, one per object. A
  commit only adds. Nothing in Git merges tables; the table in hand is the
  union, in memory, of every delta on the branch.
- A pair's SHA-256 is **Git's compat name**, the object converted as the
  [transition document](https://git-scm.com/docs/hash-function-transition.html)
  converts it, so a commit's pair is a Merkle root over everything it
  reaches and one timestamped line proves a whole history. Which SHA-256
  to use is formally [git-sha1-collisions](./git-sha1-collisions.md)'s
  decision; this is the assumption.
- The walk is **post-order** and **prunes** at any object already paired,
  which is safe because post-order recording keeps the table closed under
  reachability. A pruned pair records that the commit reaches the object
  *as observed earlier*. So a run costs the new content.
- Each `disot` commit's tree holds **two files**: the delta, the pairs new
  since the parent; and the record, the delta's SHA-256 blob name beside
  the RFC 3161 token whose imprint is that name. The tree entry gives the
  delta's SHA-1, the record its SHA-256, so the commit pairs its own delta
  without the delta naming itself. The commit is plain: no signature, no
  header. The next delta records the parent commit, its tree and its
  record, which the parent could not name.
- A run over a covered repository still commits: its delta holds the
  parent's three objects and its token renews the chain.

### Skeleton: `fjs tts`

The smallest version that works: a milestone to build on, not a release,
since it checks nothing the additions below check. One option,
`--tsa <url>`. It reads committed objects and writes objects and one ref;
it never touches the index or the working tree.

1. **Read the cache.** If `refs/heads/disot` exists, scan its commits and
   take the union of their deltas in memory, plus one pair per commit for
   its delta: the tree entry's SHA-1, the record's SHA-256. Otherwise the
   cache is empty and the new commit has no parent.
2. **Walk** from `HEAD`, and from the `disot` head, whose commit, tree and
   record no delta holds yet, recording what the cache lacks. Commits,
   trees and blobs only; anything else met is refused.
3. **Write the delta**, `sha1-sha256-map.json`: one JSON object, SHA-1 keys
   in lowercase hex in ascending order, SHA-256 values in lowercase hex,
   no whitespace.
4. **Timestamp it.** Request an RFC 3161 timestamp with the delta's SHA-256
   blob name as imprint; on a granted response write the record,
   `tts.json`: `{"sha256":"…","tts":"…"}`, members in that order, the
   token as DER in standard base64 with padding, no whitespace, no
   escapes.
5. **Commit** the two blobs and their tree, with the `disot` head as the
   one parent, and move `refs/heads/disot` to it. Nothing is fetched or
   pushed.

### Additions

Each stands alone, after the skeleton, as its own pull request. The
concern comes first, then the fix.

- **The response is not checked.** A bad or forged response gets recorded.
  Check status, imprint, nonce, signature and the signer's certificate
  chain before writing, as [disot-cli-epic](../fjs/todo/disot-cli-epic.md)
  asks; request with `certReq` so the token carries the certificate and a
  clone can check it from the blobs alone.
- **The cache is not checked.** A damaged or substituted delta feeds the
  cache, and pruning then stops the walk at wrong pairs. Hash each delta
  as a blob and require the record's SHA-256; refuse two names for one
  SHA-1; refuse a delta or record spelled any way but the canonical one.
- **Two local runs can race.** The second moves the ref over the first's
  commit. Move `refs/heads/disot` only if it still holds what step 1
  read, a compare-and-swap
  [`fjs/git/refstore/write`](../fjs/git/refstore/write/module.f.mjs)'s
  `tryWrite` does not do yet.
- **A checked-out `disot`.** Moving its ref under a worktree disturbs that
  worktree, and a `HEAD` that is `disot` names nothing to map. Refuse, as
  `git branch -f` does.
- **A SHA-256 repository.** Its content already has the name, and the
  reverse conversion is not this command's. Refuse.
- **Gitlinks.** A submodule commit's pair belongs to its own `disot`
  branch, so a tree holding one cannot be named here. The skeleton refuses
  it; whether the table should name the boundary is open.
- **Raced publishers.** Two publishers who raced produce two heads, and the
  skeleton writes one parent; `git branch -f` replaces rather than joins.
  A way to name a second trusted head as a further parent.
- **Shallow clones.** A walk that cannot reach the bottom cannot close the
  table. Refuse, or publish an unclosed part marked as such.
- **Remote heads.** The skeleton reads only the local branch, since
  pruning at another party's pairs is trusting them. A user adopts a
  remote's `disot` by making it their own branch; anything more is the
  trust question below.
- **A local index**, for a reader that answers one SHA-1 without scanning
  the branch. Tooling, not format.

### What a timestamp proves

- **Existence by a time.** The token's time plus its accuracy is the bound;
  a token without an accuracy gives its time and claims no bound.
  The proof is the token plus the objects: a reader recomputes the name
  from the bytes and compares. The earliest bound naming the content is
  the whole proof.
- **Why the chain keeps adding timestamps.** A token verifies only while
  its authority's certificate does; a later token over the chain proves
  the earlier one existed before that, if the later bound comes first.
  That is the renewal RFC 3161 describes.
- **The imprint is a SHA-256 name.** Hashing anything by SHA-1 would bind a
  name an attacker can collide.

### Out of scope

Reading the record is a separate design: verifying a branch (tokens
against their authorities, substituted twins, closure), trust between
parties, two records for one SHA-1 (a collision, always reported; the
oldest pair as the working default), suppression of the honest head, and
a miss. The record authenticates only the timestamp authority; the commit
is unsigned and its author line is a claim.

### Tasks

Skeleton:

- [ ] The delta and record writers and readers.
- [ ] The timestamp request, reusing the RFC 3161 handling
      [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
      defines.
- [ ] The walk over [`fjs/git/store`](../fjs/git/store/module.f.mjs) and
      [`fjs/git/walk`](../fjs/git/walk/module.f.mjs), with a proof that a
      second run over an unchanged repository records only the renewal.
- [ ] A loose-object writer: nothing in [`fjs/git`](../fjs/git/README.md)
      writes an object yet, and the effects have `inflate` and no
      `deflate`. Then the branch tip.
- [ ] `fjs tts`: read, walk, write, timestamp, commit.

Then the additions, one each.

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
