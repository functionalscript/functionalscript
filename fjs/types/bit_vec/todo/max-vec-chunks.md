## The largest `Vec` size, imported by the hosts too

**Priority:** P4
**Status:** wip

### Problem

[`module.f.mjs`](../module.f.mjs) exports the most bytes a `Vec` holds as a
`number`, `maxVecBytes`, and the chunker at that size,
`u8ListToMaxVecChunksMsb`; `git/refstore/write`, `cas/git`, `ci/cache`,
`git/packstore` and `git/refstore/name` use them. One copy is left:
`effects/node`'s `_maxVecBytes`, which is `Number(maxLengthBytes)` again and
which the Node and SpiderMonkey hosts import for their read windows and
`inflate`'s output limit.

### Tasks

- [ ] `effects/node/module.f.mjs`, `effects/node/module.mjs` and
      `effects/spidermonkey/module.mjs` import `maxVecBytes`; `_maxVecBytes`
      goes.

### Related

- [byte-aligned-vec](./byte-aligned-vec.md) — a byte-aligned type, where the
  limit would live if that lands.
