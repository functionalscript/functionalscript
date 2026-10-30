## Trusted timestamps over SHA-1 history, kept in a `disot` branch

**Priority:** P2
**Status:** open

### Problem

A trusted timestamp (TTS, RFC 3161) proves that a digest existed at a time.
DISOT (Decentralized Immutable Source of Truth:
[what it is](https://medium.com/@sergeyshandar/digital-space-how-it-should-be-done-4c2f3bd3cf9e),
[architecture](../doc/plan/architecture.md)) wants that proof to be about Git
content, and wants it now: every day a history goes without a timestamp is
evidence not collected, and no later timestamp dates anything earlier than
itself. In practice every host, clone and old repository names its objects
by SHA-1, whose collision resistance is broken
([git-sha1-collisions](./git-sha1-collisions.md)).

Those are two concerns, and this issue takes the first alone: a timestamp
over the history as the hosts hold it, SHA-1 names included, with the risk
that carries stated below and accepted. The second — a SHA-256 name for
every SHA-1 object, so that a timestamp names one content and not one of a
colliding pair — is [git-sha256-map-branch](./git-sha256-map-branch.md),
which builds on the branch this issue defines and adds the map to it. The
order is deliberate: timestamps first, the map after, with timestamps of its
own from the day it lands.

### Risk: what a timestamp over SHA-1 names proves

The imprint a timestamp binds is a SHA-256 digest over the message the
branch records, and the message names the commits it covers by SHA-1
([what a timestamp proves](#what-a-timestamp-proves)). So until the map
lands, everything the timestamp vouches for — the head commit, and
through its tree and parents everything it reaches — is named by a hash
whose collision resistance is broken. The risk is that one of those names
names two objects.

Against the attacks known today it does not:

- **Every known attack is a collision, and every one needs the attacker to
  author both objects.** There is no second-preimage attack on SHA-1: no
  known way to take an object that exists and make another with its id. An
  honestly made object has no twin.
- **A collision an attacker did author is content the attacker
  contributed**, and the hosts DISOT targets reject it on push with
  `sha1dc`, as Git itself does on `hash-object` and `index-pack`. The known
  attacks leave disturbance vectors `sha1dc` detects
  ([git-sha1-collisions](./git-sha1-collisions.md)).

What is left is an attack not known today — a practical second preimage, or
a collision shape `sha1dc` does not see — found after the timestamp was
made. Such an attack would let an attacker make a twin of an object the
message names or reaches, and the timestamp alone could not tell the two
apart. Two things bound that:

- The map closes the exposure from the day it lands: from its first commit
  the same history carries SHA-256 names under a timestamp of its own, and
  a verifier that has both checks both. The exposure is the window between
  this issue's first timestamp and the map's first commit.
- Every Git repository on every host rests on the same assumption with no
  timestamp at all. In that window DISOT is as safe as the hosts it runs
  on, and after it, safer.

The alternative — no timestamp until the map exists — trades a bounded
exposure to a hypothetical attack for a certain loss: the time between now
and the map, which no later timestamp recovers. That is the trade this issue
refuses.

The risk is accepted as stated. What this decision does not settle is what
the map names and who vouches for it; that stays open in
[git-sha1-collisions](./git-sha1-collisions.md).

### Design

- A `disot` branch, `refs/heads/disot`, of plain commits — no signature, no
  header — each descending from the previous one, so the chain keeps adding
  timestamps for as long as the repository lives. The branch holds only
  what was observed and records no decisions.
- Each commit's tree holds **two files**: the message and the record.
- The **message**, `message.json`, is what the timestamp is over. It names
  the commits the timestamp covers by SHA-1, each with everything it
  reaches: the `HEAD` commit, and the parent `disot` commit, through which
  the parent's tree and record, which the parent could not name itself.
  A SHA-1 is what a reader has in hand and what every host indexes, so the
  message names a commit the way the hosts do, and a reader goes from the
  message to the commit without a table. The map later extends the same
  message with a second name per object
  ([git-sha256-map-branch](./git-sha256-map-branch.md)); nothing in the
  message is redefined by it.
- The **record**, `tts.json`, holds the message's SHA-256 blob name beside
  the RFC 3161 token whose imprint is that name. The token is over the
  message, never over an object: the message is what names the objects.
- A run over an unchanged repository still commits: its message names the
  parent and its token renews the chain.

### Skeleton: `fjs tts`

The smallest version that works: a milestone to build on, not a release,
since it checks nothing the additions below check. One option,
`--tsa <url>`, a URL until
[disot-cli-epic](../fjs/todo/disot-cli-epic.md)'s profiles exist. It reads
committed objects and writes objects and one ref; it never touches the
index or the working tree.

1. **Read the branch head.** If `refs/heads/disot` exists, its commit, its
   tree and its record are the parent objects. Otherwise there are none and
   the new commit has no parent.
2. **Name the heads.** The `HEAD` commit and, when there is one, the parent
   `disot` commit. An unborn `HEAD`, or one that is `disot`, is refused.
3. **Write the message**, `message.json`: one JSON object with one member,
   `heads`, an array of the SHA-1s in lowercase hex in ascending order, no
   whitespace: `{"heads":["…","…"]}`.
4. **Timestamp it.** Request an RFC 3161 timestamp with the message's
   SHA-256 blob name as imprint; on a granted response write the record,
   `tts.json`: `{"sha256":"…","tts":"…"}`, members in that order, the token
   as DER in standard base64 with padding, no whitespace, no escapes.
5. **Commit** the two blobs and their tree, with the `disot` head as the one
   parent, and move `refs/heads/disot` to it. Nothing is fetched or pushed.

### Additions

Each stands alone, after the skeleton, as its own pull request. The concern
comes first, then the fix.

- **The response is not checked.** A bad or forged response gets recorded.
  Check status, imprint, nonce, signature and the signer's certificate chain
  before writing, as [disot-cli-epic](../fjs/todo/disot-cli-epic.md) asks;
  request with `certReq` so the token carries the certificate and a clone
  can check it from the blobs alone.
- **The parent is not checked.** A damaged or substituted record is built
  on, and the chain then renews a wrong link. Hash the parent's message as
  a blob and require the record's SHA-256; refuse a message or record
  spelled any way but the canonical one.
- **Two local runs can race.** The second moves the ref over the first's
  commit. Move `refs/heads/disot` only if it still holds what step 1 read,
  a compare-and-swap
  [`fjs/git/refstore/write`](../fjs/git/refstore/write/module.f.mjs)'s
  `tryWrite` does not do yet.
- **A checked-out `disot`.** Moving its ref under a worktree disturbs that
  worktree, and a `HEAD` that is `disot` names nothing to timestamp. Refuse,
  as `git branch -f` does.
- **A SHA-256 repository.** Its content already has the name the map would
  add, and whether this branch should still timestamp it is the map's
  question. Refuse until it is answered.
- **Raced publishers.** Two publishers who raced produce two heads, and the
  skeleton writes one parent; `git branch -f` replaces rather than joins. A
  way to name a second trusted head as a further parent.
- **Remote heads.** The skeleton reads only the local branch, since
  building on another party's record is trusting them. A user adopts a
  remote's `disot` by making it their own branch; anything more is the
  trust question below.

### What a timestamp proves

- **Existence by a time.** The token's time plus its accuracy is the bound;
  a token without an accuracy gives its time and claims no bound. The proof
  is the token plus the objects: a reader recomputes the name from the
  bytes and compares. The earliest bound naming the content is the whole
  proof.
- **Why the chain keeps adding timestamps.** A token verifies only while its
  authority's certificate does; a later token over the chain proves the
  earlier one existed before that, if the later bound comes first. That is
  the renewal RFC 3161 describes.
- **The imprint is a SHA-256 name of the message.** The token binds the
  message's bytes with a hash whose collision resistance is intact; what
  the message binds is whatever names it holds — SHA-1 here, SHA-256
  beside it once the map lands — which is the
  [risk](#risk-what-a-timestamp-over-sha-1-names-proves) above.

### Out of scope

Reading the record is a separate design: verifying a branch (tokens against
their authorities, substituted twins), trust between parties, suppression of
the honest head, and a miss. The record authenticates only the timestamp
authority; the commit is unsigned and its author line is a claim. The map,
and everything that is only a concern once there is one — the walk, pruning,
closure, two names for one SHA-1 — is
[git-sha256-map-branch](./git-sha256-map-branch.md).

### Tasks

Skeleton:

- [ ] The message and record writers and readers, with a proof that a
      second run over an unchanged repository records only the renewal.
- [ ] The timestamp request, reusing the RFC 3161 handling
      [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
      defines.
- [ ] A loose-object writer: nothing in [`fjs/git`](../fjs/git/README.md)
      writes an object yet, and the effects have `inflate` and no
      `deflate`. Then the branch tip.
- [ ] `fjs tts`: read, name, write, timestamp, commit.

Then the additions, one each.

### Related

- [git-sha256-map-branch](./git-sha256-map-branch.md) — the second stage:
  the SHA-1 → SHA-256 map added to this branch, closing the risk above.
- [git-sha1-collisions](./git-sha1-collisions.md) — the attacks, `sha1dc`,
  and the open questions about what the map names.
- [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
  — the RFC 3161 handling this reuses; its commit headers are not used
  here.
- [git-name-resolution](./git-name-resolution.md) — the other DISOT
  metadata.
- [disot-cli-epic](../fjs/todo/disot-cli-epic.md) — where the command lands.
- [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md) — collision
  detection for the SHA-1 side.
- [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html) — the token, its
  accuracy, and renewal.
