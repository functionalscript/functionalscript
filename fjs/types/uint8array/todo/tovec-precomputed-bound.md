## `toVec` precomputes a size bound

**Priority:** P3
**Status:** open

### Problem

Two adjacent functions do the same job with opposite discipline
(`module.f.mjs:30-39`):

```js
export const toVec = input => {
    assert(input.length <= maxLengthBytes, "the array is too big")
    return u8ListToVecMsb(fromArrayLike(input))
}

export const listToVec = input =>
    assertNotNullish(tryU8ListToVecMsb(flat(m(input))), "the array is too big")
```

AGENTS.md §5.6 ("Never precompute a size to predict whether something fits")
names `tryU8ListToVec` as the `try*` variant to use instead — `listToVec`
obeys it, `toVec` re-derives a byte-count bound. The guard is also redundant:
`u8ListToVec` is the unwrapping form of `tryU8ListToVec`, so the real check
already runs inside.

### Proposal

`export const toVec = input => listToVec([input])` — the same list
(`flat(map(fromArrayLike)([input]))`), the same error message, and `assert` /
`maxLengthBytes` drop out of the imports.

### Tasks

- [ ] Rewrite `toVec` through `listToVec` and drop the `assert` /
      `maxLengthBytes` imports
