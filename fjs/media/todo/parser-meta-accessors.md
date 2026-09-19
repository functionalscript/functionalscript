## parser-meta-accessors. One owner for the tagged-symbol accessors

**Priority:** P4
**Status:** open

### Problem

`datajs/parser` imports `stringMappings` from `json/parser` — deliberate
reuse the datajs todos call out — but the accessor that reads what those
shared mappings produce is copied byte-for-byte:

```js
// fjs/media/json/parser/module.f.mjs            // fjs/media/datajs/parser/module.f.mjs
const textAt = node => {                          const textAt = node => {
    const { meta } = symbolAt(node)                   const { meta } = symbolAt(node)
    assert(meta.id === 'text')                        assert(meta.id === 'text')
    return meta.value                                 return meta.value
}                                                 }
```

The `Text` *type* is already shared (`datajs/parser/types.ts` imports it
from `json/parser/types.ts`), so the type has one owner and its reader has
two. The same wrap/read pair repeats with only the `id` changed —
`jsonSymbol`/`jsonAt` in `json/parser/module.f.mjs`,
`valueSymbol`/`nodeAt` in `datajs/parser/module.f.mjs` — and
`valueSymbol` is written a third time in
`fjs/media/datajs/parser/proof.f.mjs`. "Wrap a payload as a symbol under
an `id`, and read it back asserting that `id`" is one idea with several
hand-written instances across two sibling readers; the `id` tag exists
only to make the assert possible, so nothing stops another copy with a
mismatched tag.

The largest copy site is outside `fjs/media`: `fjs/fsc/parser` reads an
eight-member alphabet, `Out`, through `outAt` and eight one-per-id
readers — `nodeAt`, `valuesAt`, `memberAt`, `membersAt`, `importAt`,
`constAt`, `exportAt`, `moduleAt` — each the same three statements with
the `id` and the field changed:

```js
// fjs/fsc/parser/module.f.mjs, nodeAt and valuesAt
const nodeAt = node => { const out = outAt(node); assert(out.id === 'value'); return out.node }
const valuesAt = node => { const out = outAt(node); assert(out.id === 'values'); return out.items }
```

Every member of `Out` carries exactly one field besides `id`, which is the
constraint `tagged` below requires, so the eight `id`-and-field steps are
instances of it. `outAt` is a different step and stays: a parser leaf's
`meta` is `DjsTokenWithMetadata | Out`, and a token deliberately has no
`id`, so `outAt`'s `assert('id' in meta)` is the narrowing from the
grammar's input alphabet to its output one, which `Tagged.at` — typed over
`{ readonly id: string }` — cannot perform. Each reader is then one line,
`node => value.at(outAt(node))`, with `outAt` kept as the shared narrowing
and the eight tag checks gone.

### Proposal

Export `textAt` from `fjs/media/json/parser/module.f.mjs` beside
`stringMappings` — it is the reader for a producer that module already
publishes — and delete `datajs/parser`'s copy. For the tagged pair, one
small helper **in the same module**, exported beside `textAt`:

```ts
import type { Meta } from '../../../ebnf/ast/types.ts'
/** Whether `T` is a union of two or more members. */
type _IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never
/** `true` where some member of `O` has an `id` that is not one literal: the widened `string`, or a union. */
type _NotSingleton<O extends { readonly id: string }> =
    O extends unknown ? (string extends O['id'] ? true : _IsUnion<O['id']> extends true ? true : never) : never
/** The ids an alphabet may be addressed by: its members' `id`s where every one is a single literal, `never` otherwise. */
type _LiteralId<O extends { readonly id: string }> = [_NotSingleton<O>] extends [never] ? O['id'] : never
/** The member of the alphabet `O` that `Id` names — computed, never supplied. */
type _Member<O, Id extends string> = Extract<O, { readonly id: Id }>
/**
 * The one field of `M` besides `id`, or `never` where `M` has none or more
 * than one — so a member `tagged` cannot build whole has no key to name.
 */
type _OnlyKey<M> =
    [Exclude<keyof M, 'id'>] extends [never] ? never :
    _IsUnion<Exclude<keyof M, 'id'>> extends true ? never :
    Exclude<keyof M, 'id'>
/** `true` for each member of `M` that could carry the id `Id` yet is not `T`: a collider the runtime tag test cannot tell from `T`. */
type _Collides<Id extends string, T, M extends { readonly id: string }> =
    M extends unknown ? (Id extends M['id'] ? ([M] extends [T] ? never : true) : never) : never
/** `unknown` where every member of `M` that could carry `Id` is `T` itself; `never` otherwise, so a node over `M` is refused. */
type _Admits<Id extends string, T, M extends { readonly id: string }> =
    [_Collides<Id, T, M>] extends [never] ? unknown : never
/**
 * A tagged output symbol: the member of the alphabet `O` that `Id` names,
 * which must carry exactly one field besides `id`, and that field's key
 * `K`. `symbol` builds `{ symbol: 0, meta: { id, [key]: payload } }` — the
 * whole member, by construction — and `at` reads the payload back from a
 * node over any alphabet `M` in which nothing but that member can carry
 * `Id`, asserting `meta.id === id`.
 */
export type Tagged<O extends { readonly id: string }, Id extends _LiteralId<O>, K extends _OnlyKey<_Member<O, Id>>> = {
    readonly symbol: (payload: _Member<O, Id>[K]) => Meta<_Member<O, Id>>
    readonly at: <M extends { readonly id: string } = never>(node: (Meta<M> | readonly unknown[]) & _Admits<Id, _Member<O, Id>, M>) => _Member<O, Id>[K]
}
export const tagged: <O extends { readonly id: string }, Id extends _LiteralId<O>, K extends _OnlyKey<_Member<O, Id>>>(id: Id, key: K) => Tagged<O, Id, K>
```

**Every instance is a typed `const`.** `O` appears in no argument, so
nothing infers it from `(id, key)`: a bare `tagged('text', 'value')`
resolves `O` to its constraint, whose `_LiteralId` is `never`, and
`'text'` is refused — checked at this head, `"text" is not assignable to
never`. What supplies `O` is the annotation: TypeScript infers a call's
type parameters from its contextual return type, and `Tagged<O, Id, K>`
names all three, so the three instances are

```js
/** @type {Tagged<Text, 'text', 'value'>} */
const text = tagged('text', 'value')
/** The string a `Text` node carries. */
export const textAt = text.at
/** @type {<P>() => Tagged<Out<P>, 'json', 'result'>} */
const json = () => tagged('json', 'result')
```

in `json/parser` — the JSON pair is generic in the numeric policy, so it
is a thunk over `P`, instantiated where `P` is bound, which is exactly
where `jsonSymbol`/`jsonAt` are used today (inside `mappings(policy)` and
the value mapping) — and `/** @type {Tagged<Out, 'value', 'node'>} */
const value = tagged('value', 'node')` in `datajs/parser`, whose `Out` is
DataJS's alphabet. `Tagged` is public API because every instance names
it; `_IsUnion`, `_NotSingleton`, `_LiteralId`, `_Member`, `_OnlyKey`,
`_Collides` and `_Admits` are `_`-prefixed types beside it in
`json/parser/types.ts` — **not** `private.ts`: `tagged` and `Tagged` are
exported and their declarations name them, so they are inside the public
declaration closure and must ship with it; `private.ts` is for types
outside that closure, and a generated public declaration must never point
at one (`fjs/AGENTS.md`, "the public declaration closure"). The `_` says
they are not API; the file says they are reachable. Each pair is then one
line naming its alphabet, `id`, and field. `datajs/parser` exports its
pair to the proof as **`_valueSymbol`** — the proof is its only
cross-module consumer, so the export is linkage, not API, and the `_`
prefix is what says so (`fjs/AGENTS.md`, "exportability is linkage, not
API status"); the proof then imports it instead of restating it.

`tagged` is for **single-payload** members, and the type says so rather
than assuming it: `K` ranges over `_OnlyKey<M>`, which is the member's
one non-`id` key and `never` otherwise, so for a member such as
`{ id: 'pair', left: number, right: string }` no `K` exists and
`Tagged<O, 'pair', 'left'>` is refused at compile time — `symbol(1)`
cannot advertise a `Meta` of a member it built half of. The `id`
convention guarantees one metadata type per `id`, not one field per
type; this constraint adds the second guarantee for the members `tagged`
takes. All three existing members (`Text`, `Json<P>`, `Value`) are
single-payload, so nothing today is excluded; a future two-field member
writes its own pair, as it would have had to anyway.

The alphabet's ids must be **single literals**, and `_LiteralId<O>`
enforces that where `Extract` alone cannot. `Extract` selects the members
whose `id` is assignable to `Id`, so an alphabet such as
`{ id: 'foo', value: string } | { id: string, value: number }` — or
`{ id: 'foo', value: string } | { id: 'foo' | 'bar', value: number }` —
would have `_Member<O, 'foo'>` select the first member alone while a node
of the second, whose runtime `id` may be `'foo'`, passes the tag test and
hands back a number typed as a string. `_NotSingleton` is `true` for a
member whose `id` is the widened `string` or a union, `_LiteralId<O>`
collapses to `never` for the whole alphabet, and no `Id` exists:
`Tagged<O, 'foo', 'value'>` over either alphabet does not instantiate
(checked for both). The three real alphabets have only single literal
ids (`'text'`, `'json'`, `'value'`), so nothing today is refused.

The metadata type is **computed from the alphabet, not supplied**: the
caller names `O`, an `Id` drawn from `O['id']`, and a key, and the
shape is `Extract<O, { id: Id }>` — the alphabet's own member, exactly.
That closes the structural hole a free `M extends O` left open: there is
no parameter a wider `Text & { foo: number }` could be passed through,
so `symbol` builds only what the alphabet declares and `at` returns only
a field the alphabet's member has. Within `O` the `id` selects one
member by the convention `fjs/ebnf/ast/README.md` states ("an `id` names
one metadata type: two shapes under one `id` would be one alphabet with
nothing to tell them apart"), so `Extract` yields one shape and the
runtime `id` assertion is exactly the check that convention leaves to
make; [`mapping-precheck`](../../ebnf/ll1/todo/mapping-precheck.md) is
where the convention becomes a checked constraint.

**What `at` accepts** is decided by the node, not by the layer. `M` is
inferred from the node's `meta` — the whole alphabet the node is typed
over, as one union — and `_Admits` walks its members: any member that
could carry `Id` (a literal `'text'`, a union `'text' | 'x'`, the
widened `string`) must be the member `tagged` reads, or the parameter
collapses to `never` and the call is refused. Checked at this head:
`textAt` accepts every node shape both readers hand it (`Meta<Utf16 |
Out<P>>`, `Meta<Utf16 | Out>`, `Meta<Utf16>`, `readonly unknown[]`),
accepts a subtype of `Text` (its `value` is still a string), keeps
accepting when either alphabet grows a third or fourth member, and
refuses a literal collider `{ id: 'text', value: number }`, a widened
`{ id: string, value: number }`, a union-id `{ id: 'text' | 'x', value:
number }`, and the literal collider hidden in a four-member alphabet.
That is the guarantee: whatever passes the runtime tag test carries the
declared payload, so `textAt` returns a string by type and needs no
runtime payload check. Two earlier forms were tested and are not this
one. A plain `Exclude<O, { id: 'text' }>` is bypassed by the widened
member. A conditional in the parameter, `Meta<Utf16 | Text | ('text'
extends O['id'] ? never : O)>`, infers `O` only by subtraction — the one
member left after `Text` is matched — so it is right for every alphabet
today, where each has exactly one other member, and wrong the moment one
gains a third: two leftover members infer as their common supertype, not
their union, and the node is refused. The whole-union inference through
`Meta<M>` has no such edge, which is why `_Admits` replaces it.

What that gives up is a nominal bound the runtime never had: `at` no
longer refuses a node of a *foreign* alphabet that merely does not
collide — `json`'s `at` accepts a DataJS node, since nothing in `Text |
Value` can carry `'json'` — where a parameter typed over the layer's own
alphabet would have. The runtime reads `meta.id` and one field and is
alphabet-agnostic already; the type now promises exactly what that read
can be trusted for, and `textAt`, the one reader that crosses layers,
needs precisely this. `text` (the constructor) stays JSON-local: DataJS
reuses JSON's string mappings, which build `Text` symbols, so it never
constructs one itself.

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

- [ ] Export `textAt`, `tagged`, and the `Tagged` type from
      `json/parser`; drop `datajs/parser`'s copy; rewrite the four
      wrap/read functions as typed `const` instances; the proof imports
      `_valueSymbol` instead of restating it.
- [ ] `fjs/fsc/parser`: the eight readers become typed `tagged`
      instances composed after `outAt`, which stays as the narrowing from
      input to output metadata.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/media/datajs/parser/module.f.mjs`](../datajs/parser/module.f.mjs)
  — imports `stringMappings` from `json/parser`: the rule/mapping reuse
  this issue extends to the accessors, shipped (its issue file,
  `parser-serializer`, is deleted).
- [../../ebnf/ll1/todo/mapping-precheck.md](../../ebnf/ll1/todo/mapping-precheck.md)
  — owns the first library reader of `meta.id`; `tagged` moves into
  `fjs/ebnf/ast` only after it.
