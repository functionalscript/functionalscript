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
small helper **in the same module**, exported beside `textAt`:

```ts
import type { Meta } from '../../../ebnf/ast/types.ts'
import type { Utf16 } from '../../../ebnf/utf16/types.ts'
/** A node a reader may be handed: a symbol of either alphabet, or a subtree. */
type _Readable = Meta<Utf16 | { readonly id: string }> | readonly unknown[]
/**
 * A tagged output symbol over the metadata type `M` and its one payload
 * field `K`: `symbol` builds `{ symbol: 0, meta: { id, [key]: payload } }`,
 * `at` reads the payload back, asserting `meta.id === id`.
 */
export const tagged: <M extends { readonly id: string }, K extends Exclude<keyof M, 'id'>>(id: M['id'], key: K) => {
    readonly symbol: (payload: M[K]) => Meta<M>
    readonly at: (node: _Readable) => M[K]
}
```

`M` is one of the existing metadata types, so the payload type is fixed
by the declaration it already has: `tagged<Text, 'value'>('text',
'value')` gives `text`/`textAt`, and `tagged<Value, 'node'>('value',
'node')` gives `datajs`'s pair. The JSON pair is generic in the numeric
policy, so it is a thunk over `P` — `/** @type {<P>() => …} */ const
json = () => tagged<Json<P>, 'result'>('json', 'result')` — instantiated
where `P` is bound, which is exactly where `jsonSymbol`/`jsonAt` are used
today (inside `mappings(policy)` and the value mapping). `_Readable` is
the node type `unitAt`/`textAt`/`jsonAt` already take, named with the
`_` prefix because it exists only to spell `tagged`'s declaration — a
private type in the public declaration closure, not API — and lives in
`json/parser`'s `private.ts`, the optional file AGENTS.md reserves for
exactly that. Each pair is then
one line naming its `M`, `id`, and field. `datajs/parser` exports its pair to
the proof as **`_valueSymbol`** — the proof is its only cross-module
consumer, so the export is linkage, not API, and the `_` prefix is what
says so (`fjs/AGENTS.md`, "exportability is linkage, not API status");
the proof then imports it instead of restating it.

It deliberately does **not** go into `fjs/ebnf/ast`. That library's
README states that nothing in it reads `meta.id` yet and reserves the
first reader — and the `Meta<M>` constraint that comes with it — for
[`../../ebnf/ll1/todo/mapping-precheck.md`](../../ebnf/ll1/todo/mapping-precheck.md).
A `tagged.at` in the AST library would be that first reader by the back
door, contradicting the README and pre-empting the precheck's design.
Both consumers of `tagged` are the JSON-family readers, so `json/parser`
is the right owner today; when the precheck lands and `Meta` carries
`id` by contract, moving `tagged` into `fjs/ebnf/ast` becomes a
one-line follow-up rather than a design decision.

### Tasks

- [ ] Export `textAt` and `tagged` from `json/parser`; drop
      `datajs/parser`'s copy; rewrite the four wrap/read functions; the
      proof imports `_valueSymbol` instead of restating it.
- [ ] `tsc`, `fjs test`.

### Related

- [../datajs/todo/parser-serializer.md](../datajs/todo/parser-serializer.md)
  — established the rule/mapping reuse this issue extends to the
  accessors.
- [../../ebnf/ll1/todo/mapping-precheck.md](../../ebnf/ll1/todo/mapping-precheck.md)
  — owns the first library reader of `meta.id`; `tagged` moves into
  `fjs/ebnf/ast` only after it.
