## parser-meta-accessors. One owner for the tagged-symbol accessors

**Priority:** P4
**Status:** open

### Problem

`datajs/parser` imports `stringMappings` from `json/parser` — deliberate
reuse the datajs todos call out — but the accessor that reads what those
shared mappings produce is copied byte-for-byte:

```js
// fjs/media/json/parser/module.f.mjs:79-84      // fjs/media/datajs/parser/module.f.mjs:65-70
const textAt = node => {                          const textAt = node => {
    const { meta } = symbolAt(node)                   const { meta } = symbolAt(node)
    assert(meta.id === 'text')                        assert(meta.id === 'text')
    return meta.value                                 return meta.value
}                                                 }
```

The `Text` *type* is already shared (`datajs/parser/types.ts` imports it
from `json/parser/types.ts`), so the type has one owner and its reader has
two. The same wrap/read pair repeats with only the `id` changed —
`jsonSymbol`/`jsonAt` in `json/parser/module.f.mjs:69-91`,
`valueSymbol`/`nodeAt` in `datajs/parser/module.f.mjs:62-77` — and
`valueSymbol` is written a third time in
`fjs/media/datajs/parser/proof.f.mjs`. "Wrap a payload as a symbol under
an `id`, and read it back asserting that `id`" is one idea with five
hand-written instances across two sibling readers; the `id` tag exists
only to make the assert possible, so nothing stops a sixth copy with a
mismatched tag.

### Proposal

Export `textAt` from `fjs/media/json/parser/module.f.mjs` beside
`stringMappings` — it is the reader for a producer that module already
publishes — and delete `datajs/parser`'s copy. For the tagged pair, one
small helper beside `symbolAt` (in `fjs/ebnf/ast`):

```ts
const tagged: <Id extends string, K extends string>(id: Id, key: K)
    => { symbol: (payload) => Meta, at: (node) => payload }
```

so `jsonSymbol`/`jsonAt` and `valueSymbol`/`nodeAt` each become one line
naming their `id` and payload field, and the proof imports `valueSymbol`
instead of restating it.

### Tasks

- [ ] Export `textAt` from `json/parser`; drop `datajs/parser`'s copy.
- [ ] Add the `tagged` pair helper; rewrite the four wrap/read functions
      and the proof's restatement through it.
- [ ] `tsc`, `fjs test`.

### Related

- [../datajs/todo/parser-serializer.md](../datajs/todo/parser-serializer.md)
  — established the rule/mapping reuse this issue extends to the
  accessors.
