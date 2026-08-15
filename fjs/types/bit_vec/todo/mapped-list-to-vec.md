## mapped-list-to-vec. The `try*ListToVec` + `mapUnwrap` pair is written once per element type

**Priority:** P4
**Status:** open

### Problem

`bit_vec` builds "concatenate a mapped list into one vector" twice — once for
`Vec` elements inside the `bo` record, once for `U8` elements as top-level
exports — with the same two-step shape and the same `mapUnwrap` lift:

```js
// fjs/types/bit_vec/module.f.mjs:297-305 (inside bo)
const unpackedListToVec = unpackListToVec(unpackConcat)
const tryListToVec = list => unpackedListToVec(mapUnpack(list))
...
listToVec: mapUnwrap(tryListToVec),

// fjs/types/bit_vec/module.f.mjs:373-386
export const tryU8ListToVec = ({ unpackConcat }) => {
    const unpackedListToVec = unpackListToVec(unpackConcat)
    return list => unpackedListToVec(mapU8ToUnpacked(list))
}
...
export const u8ListToVec = bo =>
    mapUnwrap(tryU8ListToVec(bo))
```

The only difference is the element-to-`Unpacked` map (`mapUnpack` at `:188` vs
`mapU8ToUnpacked` at `:193`). The module already has exactly this combinator
for the opposite direction — `mappedChunkList` (`:423-427`) parameterizes
chunking by an in-map and an out-map, and `chunkList`/`unpackedChunkList`
(`:437`, `:445`) are its two instantiations — so the abstraction exists and
just was not applied to concatenation.

### Proposal

Mirror `mappedChunkList`:

```js
/** @type {<I>(g: (i: I) => Unpacked) => (bo: BitOrder) => (list: List<I>) => Nullable<Vec>} */
const mappedListToVec = g => ({ unpackConcat }) => {
    const f = unpackListToVec(unpackConcat)
    return list => f(map(g)(list))
}
```

Then `tryListToVec = mappedListToVec(unpack)(bo)` inside `bo`, and
`tryU8ListToVec = mappedListToVec(u8ToUnpacked)`, with both unwrapping
variants staying `mapUnwrap(...)` one-liners.

### Tasks

- [ ] Add `mappedListToVec`; re-derive `tryListToVec`/`listToVec` and
      `tryU8ListToVec`/`u8ListToVec` from it.
- [ ] `npx tsc`, `fjs t` — pure refactor, `bit_vec` proofs pass unchanged.

### Related

- `fjs/types/bit_vec/module.f.mjs:423-427` — `mappedChunkList`, the precedent
  this mirrors.
