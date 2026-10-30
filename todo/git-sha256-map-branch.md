## SHA-1 → SHA-256 map, kept in the `disot` branch

**Priority:** P2
**Status:** open

### Problem

[git-trusted-timestamp-branch](./git-trusted-timestamp-branch.md) timestamps
a SHA-1 history as the hosts hold it, and states the risk that accepts: the
timestamp is over a message that names the head commit, and through it
everything it reaches, by SHA-1 — names an attacker who can collide SHA-1
can make two of ([git-sha1-collisions](./git-sha1-collisions.md)). This issue closes that
risk: a second name for every object the history reaches, a SHA-256 over
the content, timestamped beside the SHA-1 names so that the proof names
*which* content and not one of a colliding pair.

Git can name objects by SHA-256, and in practice every host, clone and old
repository is SHA-1. So the content stays where it is, and DISOT adds the
second name beside it: a **mapping table** from SHA-1 object id to SHA-256
name, kept on the same `disot` branch, each delta in a commit beside a
trusted timestamp over the message that carries the delta. The branch, its
message, its record and its renewing chain are the timestamp issue's; this
issue extends the message with the delta and adds the walk that fills it.

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
- The **delta**, the pairs new since the parent, is a second member of the
  message, `map`, after `heads`: `{"heads":[…],"map":{"<sha1>":"<sha256>",…}}`.
  The record is unchanged: the message's SHA-256 blob name beside the
  RFC 3161 token whose imprint is that name. The record pairs the message;
  the commit, its tree and the record itself no delta holds yet, so the
  next delta records them.
- A run over a covered repository still commits: its delta holds the
  parent's objects and its token renews the chain.
- A branch grown before this issue holds messages with `heads` and no
  `map`. They stay as they are: their timestamps hold, and the first run
  with the map walks the whole history, since nothing before it is paired.
  From that commit on, every head carries both names.

### `fjs tts` with the map

The timestamp issue's skeleton, with a walk after it names the heads and
the delta added to the message. The same rules hold: a milestone to build
on, `--tsa <url>`, committed objects in, objects and one ref out, never the
index or the working tree.

1. **Read the cache.** If `refs/heads/disot` exists, scan its commits and
   take the union of their `map` members in memory, plus one pair per
   commit for its message: the tree entry's SHA-1, the record's SHA-256. A
   message without a `map` contributes nothing. Otherwise the cache is
   empty and the new commit has no parent.
2. **Walk** from the heads the message names — `HEAD`, and the `disot`
   head, whose commit, tree and record no delta holds yet — recording what
   the cache lacks. Commits, trees and blobs only; anything else met is
   refused.
3. **Write the message**, `heads` as the timestamp issue writes it, then
   `map`: SHA-1 keys in lowercase hex in ascending order, SHA-256 values in
   lowercase hex, no whitespace.
4. **Timestamp it** and write the record as the timestamp issue does.
5. **Commit** the two blobs and their tree, with the `disot` head as the
   one parent, and move `refs/heads/disot` to it. Nothing is fetched or
   pushed.

### Additions

Each stands alone, as its own pull request, beside the timestamp issue's
own additions, which hold here unchanged. The concern comes first, then
the fix.

- **The cache is not checked.** A damaged or substituted delta feeds the
  cache, and pruning then stops the walk at wrong pairs. Hash each message
  as a blob and require the record's SHA-256; refuse two names for one
  SHA-1; refuse a message spelled any way but the canonical one.
- **A SHA-256 repository.** Its content already has the name, and the
  reverse conversion is not this command's. Refuse; this is the answer the
  timestamp issue left open.
- **Gitlinks.** A submodule commit's pair belongs to its own `disot`
  branch, so a tree holding one cannot be named here. Refuse it; whether
  the table should name the boundary is open.
- **Shallow clones.** A walk that cannot reach the bottom cannot close the
  table. Refuse, or publish an unclosed part marked as such.
- **A local index**, for a reader that answers one SHA-1 without scanning
  the branch. Tooling, not format.

### What the map adds to the proof

The timestamp issue's bound — the token's time plus its accuracy, the
proof being the token plus the objects — now names the closure: a reader
recomputes every compat name from the bytes and compares, and a colliding
twin fails the second name where it passed the first. Two records for one
SHA-1 is a collision, always reported, the oldest pair being the working
default.

### Out of scope

Reading the record is a separate design: verifying a branch (tokens
against their authorities, substituted twins, closure), trust between
parties, suppression of the honest head, and a miss. Who vouches for a
table beyond the repository that carries it — a globally approved one, or
one computed per attestation — is
[git-sha1-collisions](./git-sha1-collisions.md)'s question.

### Tasks

- [ ] Git's compat conversion — a tree, a commit and a tag with every
      embedded SHA-1 replaced by its SHA-256 twin — over the readers in
      [`fjs/git`](../fjs/git/README.md), and the compat name of each.
- [ ] The delta writer and reader, and the cache.
- [ ] The walk over [`fjs/git/store`](../fjs/git/store/module.f.mjs) and
      [`fjs/git/walk`](../fjs/git/walk/module.f.mjs), with a proof that a
      second run over an unchanged repository records only the renewal.
- [ ] `fjs tts`: the walk, and the delta in the message.

Then the additions, one each.

### Related

- [git-trusted-timestamp-branch](./git-trusted-timestamp-branch.md) — the
  branch, the message, the record, the chain, and the risk this issue
  closes.
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
