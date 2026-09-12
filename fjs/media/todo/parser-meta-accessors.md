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
/** The member of the alphabet `O` that `Id` names — computed, never supplied. */
type _Tagged<O, Id extends string> = Extract<O, { readonly id: Id }>
/** Whether `T` is a union of two or more members. */
type _IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never
/**
 * The one field of `M` besides `id`, or `never` where `M` has none or more
 * than one — so a member `tagged` cannot build whole has no key to name.
 */
type _OnlyKey<M> =
    [Exclude<keyof M, 'id'>] extends [never] ? never :
    _IsUnion<Exclude<keyof M, 'id'>> extends true ? never :
    Exclude<keyof M, 'id'>
/**
 * A tagged output symbol over the layer's output alphabet `O`: the member
 * `Id` names, which must carry exactly one field besides `id`, and that
 * field's key `K`. `symbol` builds `{ symbol: 0, meta: { id, [key]: payload } }`
 * — the whole member, by construction — and `at` reads the payload back,
 * asserting `meta.id === id`.
 */
export const tagged: <O extends { readonly id: string }, Id extends O['id'], K extends _OnlyKey<_Tagged<O, Id>>>(id: Id, key: K) => {
    readonly symbol: (payload: _Tagged<O, Id>[K]) => Meta<_Tagged<O, Id>>
    readonly at: (node: _Readable<O>) => _Tagged<O, Id>[K]
}
```

`tagged` is for **single-payload** members, and the type says so rather
than assuming it: `K` ranges over `_OnlyKey<M>`, which is the member's
one non-`id` key and `never` otherwise, so for a member such as
`{ id: 'pair', left: number, right: string }` no `K` exists and
`tagged<O, 'pair', 'left'>` is refused at compile time — `symbol(1)`
cannot advertise a `Meta` of a member it built half of. The `id`
convention guarantees one metadata type per `id`, not one field per
type; this constraint adds the second guarantee for the members `tagged`
takes. All three existing members (`Text`, `Json<P>`, `Value`) are
single-payload, so nothing today is excluded; a future two-field member
writes its own pair, as it would have had to anyway. `_IsUnion` and
`_OnlyKey` are `_`-prefixed types beside `_Tagged` in
`json/parser/types.ts`.

The metadata type is **computed from the alphabet, not supplied**: the
caller names `O`, an `Id` drawn from `O['id']`, and a key, and the
shape is `Extract<O, { id: Id }>` — the alphabet's own member, exactly.
That closes the structural hole a free `M extends O` left open: there is
no parameter a wider `Text & { foo: number }` could be passed through,
so `symbol` builds only what the alphabet declares and `at` returns only
a field the alphabet's member has. `at`'s input is `Meta<Utf16 | O>`, so
a `Meta` outside the layer's declared alphabet is a type error too.
Within `O` the `id` selects one member by the convention
`fjs/ebnf/ast/README.md` states ("an `id` names one metadata type: two
shapes under one `id` would be one alphabet with nothing to tell them
apart"), so `Extract` yields one shape and the runtime `id` assertion is
exactly the check that convention leaves to make;
[`mapping-precheck`](../../ebnf/ll1/todo/mapping-precheck.md) is where the
convention becomes a checked constraint. The instances:
`tagged<Out<P>, 'text', 'value'>('text', 'value')` gives `text`/`textAt`
for JSON, `tagged<Out, 'text', 'value'>` the same for DataJS, and
`tagged<Out, 'value', 'node'>('value', 'node')` gives `datajs`'s pair.
`_Tagged`, like `_Readable`, is a `_`-prefixed type in
`json/parser/types.ts`, inside the public closure because the exported
signature names it. The JSON pair is generic in the numeric
policy, so it is a thunk over `P` — `/** @type {<P>() => …} */ const
json = () => tagged<Out<P>, 'json', 'result'>('json', 'result')` — instantiated
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
