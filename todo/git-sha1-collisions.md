## SHA-1 collisions: what DISOT trusts when it names an object by SHA-1

**Priority:** P2
**Status:** open

### Problem

DISOT's goal is that people keep using the hosts they have — GitHub,
GitLab, Radicle — and every one of them names objects by SHA-1. So the
readers in [`fjs/git`](../fjs/git/README.md) must verify and address
SHA-1 objects ([`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md)),
and the trust DISOT builds — a signed commit anchoring its parents and its
tree by id, a trusted timestamp over it
([git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)),
a name resolved to an id ([git-name-resolution](./git-name-resolution.md))
— rests, in those repositories, on a hash whose collision resistance is
broken:

- **Identical-prefix collision**, SHAttered, 2017: two PDFs with one SHA-1.
- **Chosen-prefix collision**, 2020: an attacker picks two different
  prefixes and computes suffixes that collide, at a cost then estimated in
  the tens of thousands of dollars and falling since.
- **Not a second preimage.** No known attack takes an existing, honestly
  made object and finds another with its id. Every known attack needs the
  attacker to author *both* colliding objects. That shapes the threat: the
  danger is content an attacker contributed — a blob in a pull request, a
  tree, a commit — built to collide with a twin the attacker keeps, and
  swaps in later, wherever a verifier trusts the id alone.

Git's own answer is `sha1dc`: it computes SHA-1 while checking for the
disturbance vectors the known attacks use, and refuses an object that shows
them. GitHub has run it on push since 2017, and so does Git on every
`hash-object` and `index-pack`. It catches the attacks known today, and
nothing it does not know.

The open question is what DISOT does on top of that, since "as safe as
Git" may not be safe enough for a trust layer whose whole point is that an
id names one thing.

### Open questions

Each is a candidate, not a decision; several may combine. The answers
decide what [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md)
computes, what [`fjs/git/todo/object-store.md`](../fjs/git/todo/object-store.md)
checks on read, and what the signed payload in
[git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
covers.

1. **Compute SHA-1 with collision detection, as Git does?** The cost is a
   port of `sha1dc`'s checks beside the hash, and a verifier that refuses
   what Git refuses. It closes the attacks known today, matches what the
   hosts already enforce on push, and leaves anything new open. Is this
   the floor, and is it enough for a repository that came from a host that
   does not run it (a Radicle seed, a local clone)?

2. **A second name for every object: a SHA-1 → SHA-256 mapping.** A table
   from an object's SHA-1 id to the SHA-256 of the same bytes, so a
   verifier that has the object checks both, and a colliding twin fails
   the second. Git's own transition plan keeps exactly this table for
   interoperability (`extensions.compatObjectFormat`, the loose-object and
   pack compat indexes), which is a precedent and possibly an
   implementation to reuse. What is open is who vouches for the table:
   - **Globally approved**, published and signed by a party DISOT trusts,
     so any two verifiers agree on the SHA-256 name of a SHA-1 object. Who
     is the party, how does the table grow (per push? per attestation?),
     and what does a verifier do for an object the table does not hold?
   - **Per repository**, carried in the repository itself as a ref or a
     blob, and covered by the same signatures and timestamps as the
     history it describes. Then it is only as trusted as those, which may
     be the point.
   - **Per attestation**, computed by the signer at signing time and
     covered by the signature, so the table is not shared at all; see 3.

3. **Additional fields in the commit, and what a tree can carry.** Git
   ignores a commit header it does not know and keeps it byte for byte, and
   a commit's headers are what a signature covers, so a commit can name the
   SHA-256 of what it points to: its tree, its parents, and, through a
   Merkle root of SHA-256 over the tree's contents, every blob under it. A
   colliding blob then fails the root even though it passes the SHA-1 in
   the tree entry. A tree cannot carry extra fields (its format is fixed
   and `fsck` checks it), so the second Merkle tree lives in the commit, or
   in a blob the commit names (`.disot.*` beside the name-resolution
   files). Open: does this cover parents transitively, or only the commit's
   own tree; and what does a verifier do for history before the first
   attested commit?

4. **What the trusted timestamp already anchors.** An RFC 3161 request
   carries a `messageImprint` hashed with an algorithm the requester
   chooses, SHA-256 in practice, over the commit payload `B`; so the
   timestamp already binds the SHA-256 of the commit's bytes, headers
   included. The weak links are the ids *inside* those bytes — the SHA-1 of
   the tree and the parents. Is 3 therefore the right shape, since it makes
   the SHA-1 references inside the payload carry SHA-256 twins that the
   existing timestamp then covers for free?

5. **Which attack, exactly, is being closed.** Under known attacks, only
   content the attacker authored can collide. Is the policy then "objects
   from a contributor are re-hashed under SHA-256 at the point they are
   accepted (merged, attested, timestamped), and that name is what DISOT
   trusts from then on" — which is 2 or 3 with a clear trigger — rather than
   a defense against a second-preimage attack that does not exist?

6. **Migration.** When a host offers SHA-256 repositories and Git's
   interoperability lands, does DISOT's answer move with it — the SHA-256
   name becomes Git's own name and the table or the field goes — or is
   the DISOT name a layer above whichever hash Git uses? The mapping in 2
   suggests the second: SHA-256 as the trust name, SHA-1 as the transport
   name, whatever the repository's format.

### Tasks

- [ ] Decide 1, since it is the floor and needed whatever else is chosen;
      record the decision in `fjs/crypto/todo/sha1.md`.
- [ ] Choose between 2 and 3, or their combination, with 4 and 5 as the
      criteria; record it in
      [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
      as what the signed payload covers, and in
      [`fjs/git/todo/object-store.md`](../fjs/git/todo/object-store.md)
      as what a read checks.
- [ ] Write the threat model down, in whichever of those documents the
      decision lands in: the attacker authored both objects, and where in
      DISOT's flow that content is accepted.

### Related

- [`fjs/crypto/todo/sha1.md`](../fjs/crypto/todo/sha1.md) — the hash
  itself, and where collision detection would go.
- [`fjs/git/todo/object-store.md`](../fjs/git/todo/object-store.md) — the
  id check on read.
- [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
  — the signed payload, and the "usual hash-security assumptions" it
  names.
- [git-name-resolution](./git-name-resolution.md) — a name resolved to an
  id, and what that id is trusted to mean.
- [Git hash-function transition](https://git-scm.com/docs/hash-function-transition.html)
  — Git's own SHA-1 ↔ SHA-256 mapping and its rules.
- [SHAttered](https://shattered.io/) and
  [SHA-1 is a Shambles](https://sha-mbles.github.io/) — the identical-prefix
  and chosen-prefix attacks.
- [`sha1collisiondetection`](https://github.com/cr-marcstevens/sha1collisiondetection)
  — what Git computes.
