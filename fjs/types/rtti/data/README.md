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

A consequence is two validators: the thunk-direct one in
[`../validate`](../validate/module.f.mjs) walks the thunk graph at dispatch
time — simple, no preprocessing, good for ad-hoc use — while `validate` here
consumes a `Data` produced by `toData` and benefits from the canonical form:
unions are already flattened, subset-covered patterns already dropped. The two
coexist; users who care about repeat use convert once and keep the data form.

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
is an array whose length is constrained and whose positions carry distinct
element types. The shared pattern is a tuple-with-rest: a tuple schema is
`{ prefix }` (length exactly `prefix.length`), a uniform array is
`{ prefix: [], rest }`, and `readonly [number] ⊂ readonly number[]` is plain
pattern inclusion — which the coverage collapse uses to drop the tuple from
`or([number], array(number))`.

**Records and structs share one kind** for the same reason. A `props` entry
constrains the value *read* at that key — reading an absent key yields
`undefined`, so a key is required exactly when its set excludes `undefined`,
and `option(t)` props are optional with no extra mechanism. `rest` constrains
the values at the remaining *present* keys; a struct leaves them
unconstrained (no `rest`), matching TypeScript's structural typing.

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
  an unconstrained `rest`/prop disappears, `array(unknown)` is the whole
  array kind;
- pure `or` cycles dissolve (`X = number | X` is `number` — the least
  fixpoint), rules are pruned to the reachable set and sorted, and an entry
  rule nothing else references is inlined.

Schema identity is a property of this form, not of thunks: two `or(a, b)`
calls produce distinct thunks, but `toData(or(a, b))` and `toData(or(b, a))`
are structurally identical, and `equal`/`cmp` decide identity and canonical
order with plain structural comparison. Two known limits, both accepted by
design:

- rule *names* are part of the structure, so two recursive schemas that
  differ only in the names of their defining functions are semantically equal
  yet structurally distinct — full graph canonicalization is
  bisimulation-grade work the simple form deliberately avoids;
- a reference is never recognized as `unknown` or `never`, so e.g. a cyclic
  rule whose fixpoint happens to be the whole domain is not collapsed to
  `unknown`.

## `subset` is sound and deliberately incomplete

`subset` decides inclusion kind-wise and pattern-wise, treating reference
cycles coinductively (a reference pair is assumed included while it is being
checked — the standard equirecursive-subtyping technique). It never answers
`true` for a non-inclusion. It may answer `false` for inclusions that only
hold semantically, in the corners known to be hard:

- distributing a union across positions, e.g.
  `readonly [number | string] ⊆ readonly [number] | readonly [string]`;
- a left side that is empty only non-syntactically, e.g. `type X = [X]` has
  no finite values.

CDuce / Castagna's semantic-subtyping work and BDD-based encodings of
set-theoretic types have the complete (and far heavier) answers; this module
keeps the representation compatible with that direction — a disjoint union of
kinds is exactly the top-level shape those systems use — without paying for it
now.

## Tuple length

The data form constrains a tuple's length exactly (`{ prefix }` with no
`rest` admits only `prefix.length` elements), matching the `Ts<T>` type-level
mapping. The thunk-direct validator currently accepts extra tuple elements —
see [`../todo/tuple-extra-elements.md`](../todo/tuple-extra-elements.md) for
the divergence.
