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

`fjs/crypto/sha1/`, in the shape of `sha2`: a pure function from a byte
list to a 20-byte `Vec`, over the padded blocks, with the standard's test
vectors as its proof and the checked-in Git fixtures in
[`fjs/git/testlib.f.mjs`](../../git/testlib.f.mjs) as a second one — each
carries the id Git computed, over `<type> SP <size> NUL <payload>`.

Collision detection, if the policy issue asks for it, is a second step in
the same module: `sha1dc` computes the same hash while checking each
block's message expansion against the known disturbance vectors, and
answers whether the input shows the structure of a known attack. The
function's type then grows a second answer, a `Result` of the id or the
refusal, rather than a second function.

### Tasks

- [ ] `fjs/crypto/sha1/module.f.mjs`, with the FIPS 180-4 vectors.
- [ ] `fjs/git/oid`: an `of(type, payload)` that hashes an object at the
      repository's width, SHA-1 or SHA-256, and the fixtures' ids as its
      proof.
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
