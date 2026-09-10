## SHA-1, for Git object ids

**Priority:** P3
**Status:** open

### Problem

Every repository in use today names its objects by SHA-1, and the readers
in [`fjs/git`](../../git/README.md) read an object without ever hashing
it: `tryRead` reads bytes, `validate` vouches for their shape, and neither
can say whether the bytes are the object their file name claims, nor what
id a written object would have. Addressing an object and verifying one
both need the hash, and [`fjs/crypto/sha2`](../sha2/module.f.mjs) covers
only the SHA-256 repositories, which are rare.

Two consumers wait on it:

- [git-name-resolution](../../../todo/git-name-resolution.md) walks from a
  commit to a blob by id, and a walk that never checks an id trusts the
  store it walks.
- [git-trusted-timestamp-signatures](../../../todo/git-trusted-timestamp-signatures.md)
  writes a commit and must know the id Git will give it.

### Proposal

`fjs/crypto/sha1/`, in the shape of `sha2`: a pure function from a byte
list to a 20-byte `Vec`, over the padded blocks, with the standard's test
vectors as its proof and the checked-in Git fixtures in
[`fjs/git/testlib.f.mjs`](../../git/testlib.f.mjs) as a second one — each
carries the id Git computed, over `<type> SP <size> NUL <payload>`.

Git computes SHA-1 with collision detection (`sha1dc`): an object whose
hash was produced by the known attack is refused rather than accepted with
its colliding id. Whether a verifier here wants that is a decision for the
first consumer that verifies rather than addresses; the plain function
comes first, and the detection is its own task if wanted.

### Tasks

- [ ] `fjs/crypto/sha1/module.f.mjs`, with the FIPS 180-4 vectors.
- [ ] `fjs/git/oid`: an `of(type, payload)` that hashes an object at the
      repository's width, SHA-1 or SHA-256, and the fixtures' ids as its
      proof.

### Related

- [`fjs/git/README.md`](../../git/README.md) — the readers this addresses
  the objects of.
- [`fjs/crypto/sha2`](../sha2/module.f.mjs) — the shape to follow, and the
  other width.
