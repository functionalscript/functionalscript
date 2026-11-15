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

The imprint a timestamp binds is a digest over the message the branch
records — SHA-256, or whatever else the authority requires, never SHA-1 —
and the message names the commits it covers by SHA-1
([what a timestamp proves](#what-a-timestamp-proves)). So until the map
lands, everything the timestamp vouches for — each commit, and through
its tree and parents everything it reaches — is named by a hash
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
- Each commit's tree holds **one file**, `tts.json`, with three members:
  the message, the authority's URL, and the authority's response.
- The **message** is what the timestamp is over. It names the commits the
  timestamp covers by SHA-1, and with each everything it reaches: the
  heads of as many branches as a run is given, and the parent `disot`
  commit, through which the parent's tree and its `tts.json`, which the
  parent could not name itself. A SHA-1 is what a reader has in hand and
  what every host indexes, so the message names a commit the way the hosts
  do, and a reader goes from the message to the commit without a table.
- The message is a **JSON value**, held in `tts.json` as a value, and what
  the imprint hashes is its **serialization under a documented rule for
  its shape**. The rules are specific to each shape a message can have,
  not a general canonical JSON, so each is short enough that every reader
  gets it right. The shapes this issue defines:
  - **one SHA-1**: a string of 40 lowercase hex digits;
  - **several SHA-1s**: an array of such strings, distinct, in ascending
    order, no whitespace.

  A reader checks the message against the rule for its shape — lowercase,
  distinct, sorted — serializes it by that rule, hashes, and compares with
  the imprint; a message of no documented shape is refused. The map later
  adds a shape, and its rule, the same way
  ([git-sha256-map-branch](./git-sha256-map-branch.md)); nothing in these
  is redefined by it.
- The **imprint** is a hash over the serialized message in the algorithm
  the authority requires. SHA-256 unless it asks otherwise; an authority that
  takes only SHA-1 is refused, since that would bind a name an attacker
  can collide. The response records which algorithm was used, in the
  token's `messageImprint`.
- The **request** is a pure function of the message: the imprint and its
  algorithm, and `certReq`, so the token carries the certificate and a
  clone can check it from the blob alone. **No nonce.** A nonce lets a
  requester tell a fresh response from a replayed one, and a replayed
  response is a genuine token over the same imprint, proving the message
  existed by an earlier time — a true claim, and a stronger one. A cached
  response for a hash someone has seen before is as good as a new one. So
  the request needs no randomness, which keeps `fjs tts` free of that
  effect and its request bytes reproducible in a proof.
- The **response** is the RFC 3161 `TimeStampResp` as the authority sent
  it, status and token together, rather than the extracted token the
  commit-header design stores
  ([git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)):
  the branch records what was observed, and a verifier reads the token out
  of it. The **URL** is the authority it came from.
- A run over an unchanged repository still commits: its message names the
  parent and its response renews the chain.

### Skeleton: `fjs tts`

The smallest version that works: a milestone to build on, not a release,
since it checks nothing the additions below check. `fjs tts [<revision>…]`
timestamps the commits the revisions name, `HEAD` when none is given; one
option, `--tsa <url>`, a URL until
[disot-cli-epic](../fjs/todo/disot-cli-epic.md)'s profiles exist. It reads
committed objects and writes objects and one ref; it never touches the
index or the working tree.

1. **Read the branch head.** If `refs/heads/disot` exists, its commit is
   the parent. Otherwise the new commit has none.
2. **Write the message.** The commits the revisions name and the `disot`
   parent when there is one, in the shape their number calls for: one
   SHA-1 as a string, several as the sorted array. A revision that names
   no commit, or that is `disot`, is refused.
3. **Timestamp it.** Request an RFC 3161 timestamp with the hash of the
   serialized message as imprint, from `--tsa`. Decode the response as
   far as the token's `TSTInfo`: refuse a status other than `granted` or
   `grantedWithMods`, and refuse a `messageImprint` that is not the hash
   just sent — an authority answering for another message. Then write
   `tts.json`: `{"message":…,"tsa":"…","response":"…"}`, members in that
   order, the message as the value, the URL as given, the response as DER
   in standard base64 with padding, no whitespace outside the strings.
4. **Commit** the blob and its tree, with the `disot` head as the one
   parent, and move `refs/heads/disot` to it. Nothing is fetched or pushed.

### Additions

Each stands alone, after the skeleton, as its own pull request. The concern
comes first, then the fix.

- **The signature is not checked.** The skeleton checks the status and
  the imprint and nothing further, so a forged token with the right
  imprint gets recorded. Check the rest before writing, as
  [disot-cli-epic](../fjs/todo/disot-cli-epic.md) asks: the digest of the
  `TSTInfo` bytes against the `messageDigest` signed attribute, the
  signature over the signed attributes — retagged from `[0]` to `SET` as
  the signer saw them — with the certificate the `signingCertificate`
  attribute names, and that certificate's validity at `genTime` and its
  chain. Most public authorities sign with RSA, which
  [`fjs/crypto`](../fjs/crypto/README.md) does not have yet; this addition
  waits on a verifier for it.
- **The parent is not checked.** A damaged or substituted `tts.json` is
  built on, and the chain then renews a wrong link. Hash the parent's
  message by its rule and require the imprint in its response; refuse a
  message of no documented shape.
- **Two local runs can race.** The second moves the ref over the first's
  commit. Move `refs/heads/disot` only if it still holds what step 1 read,
  a compare-and-swap
  [`fjs/git/refstore/write`](../fjs/git/refstore/write/module.f.mjs)'s
  `tryWrite` does not do yet.
- **A checked-out `disot`.** Moving its ref under a worktree disturbs that
  worktree, and `disot` among the revisions names nothing to timestamp.
  Refuse, as `git branch -f` does.
- **A SHA-256 repository.** Its content already has the name the map would
  add, and whether this branch should still timestamp it is the map's
  question. Refuse until it is answered.
- **Raced publishers.** Two publishers who raced produce two heads, and the
  skeleton writes one parent; `git branch -f` replaces rather than joins. A
  way to name a second trusted head as a further parent.
- **Remote heads.** The skeleton reads only the local branch, since
  building on another party's `tts.json` is trusting them. A user adopts a
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
- **The imprint is a hash of the message.** The token binds the serialized
  message with a hash whose collision resistance is intact; what the message
  binds is whatever names it holds — SHA-1 here, SHA-256 beside it once
  the map lands — which is the
  [risk](#risk-what-a-timestamp-over-sha-1-names-proves) above.

### Out of scope

Reading the branch is a separate design: verifying it (responses against
their authorities, substituted twins), trust between parties, suppression
of the honest head, and a miss. A `tts.json` authenticates only the
timestamp authority; the commit is unsigned and its author line is a
claim. The map, and everything that is only a concern once there is one —
the walk, pruning, closure, two names for one SHA-1 — is
[git-sha256-map-branch](./git-sha256-map-branch.md).

### Tasks

Skeleton:

- [ ] The `tts.json` writer and reader, with a proof that a second run
      over an unchanged repository records only the renewal.
- [ ] The timestamp request, reusing the RFC 3161 handling
      [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
      defines.
- [ ] A loose-object writer: nothing in [`fjs/git`](../fjs/git/README.md)
      writes an object yet, and the effects have `inflate` and no
      `deflate`. Then the branch tip.
- [ ] `fjs tts`: read, write, timestamp, commit.

Then the additions, one each.

### Related

- [git-sha256-map-branch](./git-sha256-map-branch.md) — the second stage:
  the SHA-1 → SHA-256 map added to this branch, closing the risk above.
- [git-sha1-collisions](./git-sha1-collisions.md) — the attacks, `sha1dc`,
  and the open questions about what the map names.
- [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
  — the RFC 3161 handling this reuses; its commit headers are not used
  here, and it stores the token where this stores the response.
- [git-name-resolution](./git-name-resolution.md) — the other DISOT
  metadata.
- [disot-cli-epic](../fjs/todo/disot-cli-epic.md) — where the command lands.
- [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md) — collision
  detection for the SHA-1 side.
- [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html) — the token, its
  accuracy, and renewal.
