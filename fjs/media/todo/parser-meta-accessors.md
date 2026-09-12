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
/** A node a reader may be handed: a symbol of the input or the layer's output alphabet `O`, or a subtree. */
type _Readable<O> = Meta<Utf16 | O> | readonly unknown[]
/**
 * A tagged output symbol over the layer's output alphabet `O`, one of its
 * metadata types `M`, and `M`'s one payload field `K`: `symbol` builds
 * `{ symbol: 0, meta: { id, [key]: payload } }`, `at` reads the payload
 * back, asserting `meta.id === id`.
 */
export const tagged: <O extends { readonly id: string }, M extends O, K extends Exclude<keyof M, 'id'>>(id: M['id'], key: K) => {
    readonly symbol: (payload: M[K]) => Meta<M>
    readonly at: (node: _Readable<O>) => M[K]
}
```

`at`'s input is tied to `M` through the alphabet: a node is `Meta<Utf16
| O>`, so a `Meta` whose metadata is outside the layer's declared output
alphabet is a type error, not a runtime surprise — `tagged<Out, {
id: 'text', foo: number }, 'foo'>` does not instantiate, because that
shape is not in `Out`. Within `O` the `id` selects one shape, by the
convention `fjs/ebnf/ast/README.md` states ("an `id` names one metadata
type: two shapes under one `id` would be one alphabet with nothing to
tell them apart"), so the runtime `id` assertion is exactly the check
that convention leaves to make, and
[`mapping-precheck`](../../ebnf/ll1/todo/mapping-precheck.md) is where the
convention becomes a checked constraint. `M` is one of the existing
metadata types, so the payload type is fixed by the declaration it
already has: `tagged<Out<P>, Text, 'value'>('text', 'value')` gives
`text`/`textAt` for JSON, `tagged<Out, Text, 'value'>` the same for
DataJS, and `tagged<Out, Value, 'node'>('value', 'node')` gives
`datajs`'s pair. The JSON pair is generic in the numeric
policy, so it is a thunk over `P` — `/** @type {<P>() => …} */ const
json = () => tagged<Out<P>, Json<P>, 'result'>('json', 'result')` — instantiated
where `P` is bound, which is exactly where `jsonSymbol`/`jsonAt` are used
today (inside `mappings(policy)` and the value mapping). `_Readable` is
the node type `unitAt`/`textAt`/`jsonAt` already take, named with the
`_` prefix because it exists only to spell `tagged`'s declaration — a
private type, not API. It lives in `json/parser/types.ts`, **not**
`private.ts`: `tagged.at` is exported and its signature names
`_Readable`, so the type is inside the public declaration closure and
must ship with it — `private.ts` is for types outside that closure, and
a generated public declaration must never point at one (`fjs/AGENTS.md`,
"the public declaration closure"). The `_` says it is not API; the file
says it is reachable. Each pair is then
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
