## Read a `refDelta` whose base is in another pack

**Priority:** P5
**Status:** open

### Problem

[`packstore`](../module.f.mjs) refuses a `refDelta` whose base is not in the
pack that names it. That is what Git does with the same pack, measured with the
base in reach — the table, the control, and `git fsck`'s wording are in
`packstore`'s module doc, and `baseNotInPack` in its proof pins the refusal. So
the refusal is not a gap. What is left is a **choice**: whether to be
deliberately more capable than Git here.

### Proposal

Resolving the base through [`fjs/git/store`](../../store/module.f.mjs)'s
`readIn` would read a thin pack Git calls broken. The arguments either way:

- **For:** it could not answer *wrongly* — whatever the delta produces is
  hashed against the id asked for — so it is unlike the inputs
  [`fjs/git/pack`](../../pack/module.f.mjs)'s delta floor refuses.
- **Against:** `git fsck` reports such a pack, so reading it silently hides
  what Git reports; no Git command writes one (`index-pack --fix-thin` appends
  the bases a fetched pack lacked); and it would make `fjs/git/store` and
  `fjs/git/packstore` mutually recursive, where today the dependency runs one
  way.

The cost of *not* deciding is nil, since the refusal names the pack, the offset
and the base id.

### Tasks

- [ ] Decide; if the answer is no, record it in `packstore`'s module doc and
      delete this file.

### Related

- [`fjs/git/README.md`](../../README.md) — the readers a pack feeds, and the
  framing table that puts a pack on the decoder side.
- [`fjs/git/store`](../../store/module.f.mjs) — the read that chooses between
  loose and packed, and the whole-store read a base would resolve through.
