# `close` type

**Priority:** P2
**Status:** open — decided; implement

## Decision

Add a closed container schema:

```ts
() => ['close', Struct | Tuple, Rest?]
```

- The members declared by the `Struct` or `Tuple` must match exactly.
- Every remaining property or element must match `Rest`.
- If `Rest` is `undefined` or omitted, there must be no remaining members.

Structs and tuples on their own stay **open** — see
[retire-validate.md](./retire-validate.md). Closedness is stated, never
inferred: a schema that wants exact members writes `close`.

## The data form already has this

`ArraySet` and `ObjectSet` are both `{ members, rest? }`
(`../data/types.ts:22-55`), and every combination already validates correctly
today with no change to any code. Verified against `805aabe`, with `validate`,
`never`, and `unknown` from `../data/module.f.mjs` and `num` being
`{ number: true }`:

```js
validate([{}, { object: [{ props: { a: num }, rest: never }] }])({ a: 1, b: 2 })  // error  — closed object
validate([{}, { object: [{ props: { a: num } }] }])({ a: 1, b: 2 })               // ok     — open object
validate([{}, { array: [{ prefix: [num], rest: unknown }] }])([1, 2, 3])          // ok     — open tuple
validate([{}, { array: [{ prefix: [num] }] }])([1, 2, 3])                         // error  — closed tuple
```

So `close` needs no new concept underneath — it is the schema-form spelling of
a `rest` the data form can already carry:

| schema | data form `rest` |
| --- | --- |
| `Struct` / `Tuple` (open) | `unknown` |
| `['close', S]` | `never` |
| `['close', S, R]` | `R` |

`never` as the rest is what makes "no remaining members" fall out rather than
needing a special case: every remaining member must belong to the empty set,
so there can be none. The closed-object line above is exactly that, and it
already works.

## What has to change

### The `Type` union gains a new arity

Every existing thunk variant is fixed-arity or variadic
(`../types.ts:79-94`): `Info0` is `readonly[tag]`, `Info1` and `['const', …]`
are pairs, `['or', ...]` is variadic. `['close', S]` / `['close', S, R]` is the
first two-or-three shape. The `_AssertType` pin just below the union
(`../types.ts:96-105`) has to be extended alongside it, or it stops asserting
what it claims.

Decide whether the third slot is genuinely optional (`readonly ['close', S]`
union `readonly ['close', S, Type]`) or always present and possibly
`undefined`. The set semantics are identical — omitted and `undefined` both
mean `never` — so this is about which one reads better at a call site and
which one `visit` dispatches on more cleanly.

### `visit` gains a case

`../common/module.f.mjs:167` — `visit` routes each `Type` variant to a
`Visitor` entry, and `parse` supplies the container half. `close` is a new
tag, so it needs an entry in `Visitor` (`../common/types.ts`) and a branch in
`visit`. Note there is no `match` function in `common` despite `../README.md`
describing one; `visit` and `orVisit` are the only dispatchers.

### `parse` behavior for a closed container

`parse` currently reshapes rather than rejecting: it drops extra members and
fills a missing optional. Under `close` the extras are *declared illegal*, so
dropping them silently would make `close` and the open form behave identically
through `parse` — which would make the tag pointless.

State the rule explicitly: a closed container **errors** on a member outside
its declaration, rather than dropping it. With a `Rest`, a member matching
`Rest` is kept — decide whether it is copied into the constructed value
(needed if `Rest` is to be useful for reading) or only checked.

### `Ts<T>` mapping

`['close', S]` renders as `Ts<S>` — the exact struct or tuple, which is what
TypeScript is already good at, and is precisely the mapping `TupleTs` keeps
today (`../ts/types.ts:78-80`).

`['close', S, R]` — a struct plus an index signature over `R`, or a tuple with
a rest element — may or may not render. If it does not, that is a gap in
`Ts<T>` to document, not a reason to restrict the schema form. The model comes
first.

### `toData`

Map `close` onto `rest` per the table above. Then check `subset` / `equal` /
`cmp`: `arraySetSubset` (`../data/module.f.mjs:371-383`) reasons about
admitted lengths and `objectSetSubset` (`:414-423`) about per-key read sets,
and both already handle `rest` — but `close` makes previously unreachable
combinations reachable, so exercise them.

Canonical form matters here: the data form is content-addressed, so two
spellings of the same set must not compare unequal. `['close', S]` and
`['close', S, undefined]` must produce identical `Node`s.

## Tasks

- [ ] Extend `Type` with the `close` variant and update the `_AssertType` pin.
- [ ] Add the `Visitor` / `match` case; implement it in `parse`.
- [ ] Decide and document `parse`'s rule for a rejected extra member, and
      whether `Rest`-matching members are copied.
- [ ] `Ts<T>`: map `['close', S]`; attempt `['close', S, R]` and document the
      gap if TypeScript cannot express it.
- [ ] `toData`: emit `rest: never` / `rest: R`; canonicalize the two spellings
      of "no rest" to one `Node`.
- [ ] Exercise `subset` / `equal` / `cmp` over the newly reachable
      combinations.
- [ ] Proof coverage for each: exact match, extra rejected, extra matching
      `Rest` accepted, missing member.
- [ ] Document in `../README.md` alongside the open default.

## Related

- [retire-validate.md](./retire-validate.md) — the open default this is the
  counterpart to.
- [`../../../media/json/todo/rtti-parse.md`](../../../media/json/todo/rtti-parse.md)
  — the RTTI-aware JSON parser reuses `../parse/module.f.mjs`'s container
  behavior, so it needs a `close` case too; whichever lands second picks it up.
- `../data/types.ts:22-55` — `ArraySet` / `ObjectSet`; the `rest` field this
  maps onto.
- `../data/module.f.mjs:296-320` — `arraySet` / `objectSet` normalization,
  where `never` and `unknown` rests are collapsed today.
