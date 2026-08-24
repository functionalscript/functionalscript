# RTTI serializable data form

A function-free, serializable representation of RTTI schemas, modeled after
[`fjs/bnf/data`](../../../bnf/data/). `toData` converts a thunk-form `Type`
(from [`../module.f.mjs`](../module.f.mjs)) into this form once, lazily, when a
consumer actually needs it.

## Two forms, one job each

1. **Thunk form** — what users construct. `or(...types)` simply captures its
   arguments; no flattening, no deduplication, no subset analysis. Recursion
   uses self-referencing thunks. This is the construction surface and nothing
   more, so schemas that are built but never consumed pay nothing.
2. **Data form** (this module) — function-free, comparable, sortable,
   serializable. All schema algebra lives here: union normalization, coverage
   collapse, structural equality (`equal`), inclusion (`subset`), and canonical
   ordering (`cmp`).

A consequence is two readers: the thunk-direct
[`../parse`](../parse/module.f.mjs) walks the thunk graph at dispatch time —
simple, no preprocessing, good for ad-hoc use — while `validate` here consumes
a `Data` produced by `toData` and benefits from the canonical form: unions are
already flattened, subset-covered patterns already dropped. The two coexist;
users who care about repeat use convert once and keep the data form.

They differ in what they return, not only in how they dispatch: `parse` builds
a fresh value holding exactly the declared members, while `validate` here
answers a set-membership question about the value it was given.

## The representation is set-theoretic

A `Type` denotes a set of values and `or` is set union, so the data form
represents sets, not syntax. A `UnionSet` is a *disjoint* union over six
kinds of values; operations never cross kinds, so union, subset and equality
are kind-wise:

| kind     | representation                          | notes                                        |
| -------- | --------------------------------------- | -------------------------------------------- |
| `unit`   | bitset over `null, undefined, false, true` | `or(true, false)` is the two boolean bits — "boolean" needs no special rule |
| `number` | `true` (all) or sorted literals         | SameValue semantics: `-0 ≠ 0`, `NaN` allowed |
| `string` | `true` or sorted literals               |                                              |
| `bigint` | `true` or sorted literals               |                                              |
| `array`  | `true` or patterns `{ prefix, rest? }`  | tuples and arrays are one kind               |
| `object` | `true` or patterns `{ props, rest? }`   | structs and records are one kind             |

**Arrays and tuples share one kind** because their value sets overlap: a tuple
is an array whose leading positions carry distinct element types. The shared
pattern is a tuple-with-rest: a `prefix` entry constrains the value *read* at
that position — reading past the array's end yields `undefined`, so a position
is required exactly when its set excludes `undefined` — and `rest` constrains
every position after the prefix, admitting nothing there when it is absent. A
tuple schema is `{ prefix, rest: unknown }` (open, like a struct), a uniform
array is `{ prefix: [], rest }`, and `{ prefix }` alone is the exact-length
set. A longer tuple pattern is included in a shorter one — which the coverage
collapse uses to drop `[number, number]` from `or([number, number], [number])`,
the array counterpart of dropping `{ a, b }` from `or({ a, b }, { a })`.

**Records and structs share one kind** for the same reason, and by the same
rule one kind over: a `props` entry constrains the value *read* at that key —
reading an absent key yields `undefined`, so a key is required exactly when
its set excludes `undefined`, and `option(t)` props are optional with no extra
mechanism. `rest` constrains the values at the remaining *present* keys; a
struct leaves them unconstrained (no `rest`), matching TypeScript's structural
typing.

The two kinds spell openness with opposite `rest` values, which is what the
identity elements of the two positions differ in: undeclared *keys* are
unconstrained by default, so an open struct needs no `rest` and a closed one
would say `rest: never`; positions past a *prefix* are admitted by nothing by
default, so an open tuple says `rest: unknown` and a closed one needs no
`rest`. `arraySet` and `objectSet` normalize each identity away accordingly.

**Recursion uses named references**, following `fjs/bnf/data`: a `Data` is
`readonly [RuleSet, Node]`, where nested positions hold either an inline
`UnionSet` or the name of a rule. Unlike `fjs/bnf/data`, only definitions that
are actually cyclic become rules — everything else is inlined — so a
non-recursive schema is a pure tree with an empty rule set, and structural
identity does not depend on traversal order. Rule names come from the
defining functions' names (a recursive thunk is necessarily a named binding),
disambiguated with a counter on collision.

## Canonical form

`toData` normalizes:

- unions are flattened and merged kind-wise; literals are sorted (numbers:
  ascending, `-0` before `0`, `NaN` last) and deduplicated;
- a literal set is absorbed by its full kind (`or(42, number)` is all
  numbers); every kind is absorbed by `unknown`;
- array/object patterns are sorted, deduplicated, and *coverage-collapsed*:
  a pattern included in a sibling pattern is dropped;
- degenerate patterns are simplified: an empty position empties the pattern,
  an identity `rest`/prop disappears, a trailing position restating a `rest`
  that admits absence is dropped, and a pattern constraining nothing is its
  whole kind — `array(unknown)`, `[]` and `[unknown]` are one `Node`;
- pure `or` cycles dissolve (`X = number | X` is `number` — the least
  fixpoint), rules are pruned to the reachable set and sorted, and an entry
  rule nothing else references is inlined;
- a union structurally equal to a named rule's body reads back as a
  reference to that rule (the alphabetically first on a tie), so `or` is
  idempotent on recursive schemas — `or(list)` and `or(list, list)` are
  `list` — and a re-stated fixpoint collapses: for
  `list = readonly list[]`, `array(list)` is `list` itself.

Schema identity is a property of this form, not of thunks: two `or(a, b)`
calls produce distinct thunks, but `toData(or(a, b))` and `toData(or(b, a))`
are structurally identical, and `equal`/`cmp` decide identity and canonical
order with plain structural comparison. Two known limits, both accepted by
design:

- rule *names* are part of the structure, so two recursive schemas that
  differ only in the names of their defining functions are semantically equal
  yet structurally distinct — full graph canonicalization is
  bisimulation-grade work the simple form deliberately avoids. `subset`
  resolves references coinductively, so such a pair is a mutual `subset`
  without being `equal` — mutual inclusion implies equality of the *sets*,
  not of the spellings — and their union normalizes to whichever spelling
  sorts first;
- a reference is never recognized as `unknown` or `never`, so e.g. a cyclic
  rule whose fixpoint happens to be the whole domain is not collapsed to
  `unknown`.

## Serialization

The form is plain immutable data — no functions — so it serializes with the
repository's data serializers. DJS
([`fjs/djs/serializer`](../../../djs/serializer/module.f.mjs)) covers the
whole form, including `bigint` literal sets; plain `JSON.stringify` works
only when no `bigint` literals are involved. One corner is shared by both:
JSON's number model writes a `NaN` literal member as `null` and drops `-0`'s
sign, so a schema using those two as literal members does not round-trip
textually today and needs a serializer that preserves them.

## `subset` is sound and deliberately incomplete

`subset` decides inclusion kind-wise and pattern-wise, treating reference
cycles coinductively (a reference pair is assumed included while it is being
checked — the standard equirecursive-subtyping technique). It never answers
`true` for a non-inclusion. It may answer `false` for inclusions that only
hold semantically, in the corners known to be hard:

- distributing a union across positions, e.g.
  `readonly [number | string] ⊆ readonly [number] | readonly [string]`;
- a left side that is empty only non-syntactically, e.g. `type X = [X]` has
  no finite values;
- an array pattern shorter than the one it is included in, every position
  past its end being one the longer pattern admits as absent — only the
  longest array each side admits is tested against the other.

CDuce / Castagna's semantic-subtyping work and BDD-based encodings of
set-theoretic types have the complete (and far heavier) answers; this module
keeps the representation compatible with that direction — a disjoint union of
kinds is exactly the top-level shape those systems use — without paying for it
now.

## Tuple length

A `Tuple` schema is open on both readers, and says so here as
`{ prefix, rest: unknown }` — the same values `parse` and `../validate` admit
(see [Structs and tuples are open](../README.md#structs-and-tuples-are-open)),
including the short array whose missing positions all admit `undefined`:

```js
parse([42])([42, 'extra'])                       // ['ok', [42]]
validate(toData([42]))([42, 'extra'])            // ['ok', [42, 'extra']]
parse([number, option(string)])([42])            // ['ok', [42, undefined]]
validate(toData([number, option(string)]))([42]) // ['ok', [42]]
```

`../validate/proof.f.mjs` runs one acceptance table through all three readers,
so a `toData` that changed which values a schema admits fails there rather
than silently.

That leaves `{ prefix }`, with no `rest`, as the *exact-length* set: nothing
past the prefix, so the array is at most `prefix.length` long — and at least
as long as its last position excluding `undefined`. No thunk-form schema
spells it in general today (`array(never)` reaches only the empty array); the
planned `close` form is what will — see
[`../todo/close-type.md`](../todo/close-type.md).
