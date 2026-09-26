## `sha1dc`: SHA-1 with collision detection

**Priority:** P3
**Status:** blocked
**Blocked by:** [git-sha1-collisions](../../../todo/git-sha1-collisions.md)

### Problem

[`fjs/crypto/sha1`](../sha1/module.f.mjs) computes SHA-1 in `sha2`'s
`Hash<S, R>` shape, proven by the FIPS 180-4 vectors, and `fjs/git/oid`'s `of`
hashes a Git object with it at the repository's width. That is enough to
address an object, and to verify one against a name already trusted.

SHA-1's collision resistance is broken, though, and a verifier that must
refuse a crafted object needs more than the hash. What DISOT does about that —
collision detection as Git does, a SHA-256 twin for every SHA-1 name, a field
in the commit — is decided in
[`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md). This
issue is the detection, if that one asks for it; that one is the policy.

### Proposal

Collision detection is a second export of the same module: `sha1dc` computes
the same hash while checking each block's message expansion against the known
disturbance vectors, and answers whether the input shows the structure of a
known attack. It is a second state object of the same shape, a
`Hash<S, Result<Vec, Attack>>` whose `end` answers the id as a 20-byte `Vec` or
the refusal naming the block that showed the attack, so `computeSync` folds it
too and answers that `Result`. `sha1` stays exported as a `Hash<S, Vec>`, the
hash and nothing more, since the plain function is what a verifier that has
already decided to trust a name, and every consumer that only addresses,
computes with; `sha1dc` is the one a verifier that must refuse chooses, and
`oid`'s `of` takes whichever the policy issue picks for the store.

### Tasks

- [ ] Collision detection beside the hash, once
      [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md)
      decides it is the floor; the SHAttered PDFs as the proof it refuses.

### Related

- [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md)
  — what to do about a hash that can collide.
- [`fjs/git/README.md`](../../git/README.md) — the readers this addresses
  the objects of.
- [`fjs/crypto/sha2`](../sha2/module.f.mjs) — the shape `sha1` follows, and the
  other width.
- [framed-hash-record](./framed-hash-record.md) — shares the record `sha1` and
  `sha2` both build.
