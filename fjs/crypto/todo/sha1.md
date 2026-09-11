## SHA-1, for Git object ids

**Priority:** P2
**Status:** open

### Problem

DISOT's goal is that people keep using the hosts they have — GitHub,
GitLab, Radicle — and every one of them names objects by SHA-1, so SHA-1
is not a legacy to read past but the format most repositories will have
for years. The readers in [`fjs/git`](../../git/README.md) read a SHA-1
object without ever hashing it: `tryRead` reads bytes, `validate` vouches
for their shape, and neither can say whether the bytes are the object
their file name claims, nor what id a written object would have.
Addressing an object and verifying one both need the hash, and
[`fjs/crypto/sha2`](../sha2/module.f.mjs) covers only the SHA-256
repositories, which are rare.

Two consumers wait on it:

- [git-name-resolution](../../../todo/git-name-resolution.md) walks from a
  commit to a blob by id, and a walk that never checks an id trusts the
  store it walks.
- [git-trusted-timestamp-signatures](../../../todo/git-trusted-timestamp-signatures.md)
  writes a commit and must know the id Git will give it.

SHA-1's collision resistance is broken, and what DISOT does about that —
collision detection as Git does, a SHA-256 twin for every SHA-1 name, a
field in the commit — is decided in
[`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md).
This issue is the hash; that one is the policy. The plain function comes
first either way, since every candidate there needs it.

### Proposal

`fjs/crypto/sha1/`, in the shape of `sha2`: not a bare function but a
hash in `sha2`'s `Hash<S, R>` shape — a state object with `init`,
`append` and `end`, `S` its state and `R` what `end` answers — so that
`computeSync` there folds a list of `Vec`s through it and answers the
`R`; for `sha1`, `end` answers the 20-byte `Vec`, over the padded
blocks. The standard's
test vectors are its proof, and the checked-in Git fixtures in
[`fjs/git/testlib.f.mjs`](../../git/testlib.f.mjs) — each carrying the id
Git computed over `<type> SP <size> NUL <payload>` — are the proof of the
`oid` function that chooses the width. Both landed; what remains is the
detection.

Collision detection, if the policy issue asks for it, is a second step in
the same module, and a second export: `sha1dc` computes the same hash
while checking each block's message expansion against the known
disturbance vectors, and answers whether the input shows the structure of
a known attack. It is a second state object of the same shape, a
`Hash<S, Result<Vec, Attack>>` whose `end` answers the id as a 20-byte
`Vec` or the refusal naming the block that showed the attack, so
`computeSync` folds it too and answers that `Result`. `sha1` stays
exported as a `Hash<S, Vec>`, the hash and nothing more, since the plain
function is what a
verifier that has already decided to trust a name, and every consumer
that only addresses, computes with; `sha1dc` is the one a verifier that
must refuse chooses, and `oid`'s `of` takes whichever the policy issue
picks for the store.

### Tasks

- [x] `fjs/crypto/sha1/module.f.mjs`, with the FIPS 180-4 vectors as its
      proof; the checked-in fixtures' ids moved to `fjs/git/oid`'s proof
      with the function below, where the hash meets an object.
- [x] `fjs/git/oid`: an `of(type, payload)` that hashes an object at the
      repository's width, SHA-1 or SHA-256, and the fixtures' ids at both
      widths as its proof.
- [ ] Collision detection beside the hash, once
      [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md)
      decides it is the floor; the SHAttered PDFs as the proof it refuses.

### Related

- [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md)
  — what to do about a hash that can collide.
- [`fjs/git/README.md`](../../git/README.md) — the readers this addresses
  the objects of.
- [`fjs/crypto/sha2`](../sha2/module.f.mjs) — the shape to follow, and the
  other width.
