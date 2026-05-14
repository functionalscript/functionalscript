# 143. RTTI: Serializable Data Representation

Introduce a function-free, serializable representation of `Type` in [../fs/types/rtti/module.f.ts](../fs/types/rtti/module.f.ts), modeled after [../fs/bnf/data/](../fs/bnf/data/). All structural analysis on schemas — flattening, deduplication, subset removal, value-set coverage collapse, and canonical ordering — should run on this data form instead of on the lazy thunk graph.

## Motivation

The current `Type` is `Const | (() => Info)`. Function thunks are convenient for recursion but hard to compare: two thunks that describe the same schema are unequal under `Object.is`, have no natural ordering, and need bespoke walking with a visited set to terminate on cycles. The current ad‑hoc analysis in `reduceOr`/`flattenOr` handles a few special cases (`unknown` collapse, primitive-thunk subset, same-reference dedup) but does not scale to the remaining goals of [130](./130-or-optimization.md):

- Canonical ordering of variants (`or(a, b) ≡ or(b, a)`).
- Structural subset for tuples/structs.
- Full coverage collapse (`{ true, false }` → `boolean`, all primitive+container thunks → `unknown`).
- Stable identity for equivalent schemas built two different ways.

A serializable form gives us all of these for free: every node is comparable, sortable, and serializable; recursion becomes a named reference into a rule map.

## Design

The concrete data shape still needs to be designed — this issue is the place to do that work. The design should be grounded in **set theory**: a `Type` denotes a set of values, and `or` is set union. The representation should make that structure explicit so that union, intersection, subset, and equality become straightforward operations rather than tag-by-tag case analysis.

Sketches of the direction to explore:

- **Top level is a union of subsets of non-overlapping kinds of data.** A schema is a disjoint union over a fixed set of "kinds" (e.g. `null`-ish, booleans, numbers, strings, bigints, arrays/tuples, records/structs). Each kind contributes its own sub-representation; the kinds do not overlap, so union/intersection/subset reduce to kind-wise operations.
- **Finite-domain kinds can be encoded as bitsets.** `null`, `undefined`, `true`, `false` are singletons of a fixed, small enumeration; a bitset captures any subset of them. `or(true, false)` then collapses to "boolean" simply because the corresponding bits are set; no special-case rule needed.
- **Arrays and tuples belong to the same kind.** A tuple is just an array whose length is constrained and whose positions carry distinct element types — the value sets overlap (e.g. `readonly [number]` ⊂ `readonly number[]`), so they must share a single representation rather than be separate variants.
- **Records and structs belong to the same kind**, for the same reason: a struct is a record whose keys are constrained and whose values carry distinct types per key.
- **Recursion via named/indexed references.** Following `fs/bnf/data/`, the overall shape can be a `Record<string, UnionSet>` or `readonly UnionSet[]`; nested types reference their definitions by name or index. Cycles become reference cycles in the map, not function thunks.

The right choice of primitives (which kinds, how each kind encodes its sub-set, how references are named) is the open question. Once fixed, `or` normalization, `equal`, `subset`, canonical ordering, and serialization all fall out from kind-wise set operations.

## Downstream consumers

`validate` and `parse` can be refactored to consume the data form directly. The thunk form remains the user-facing API; a single `toData` (and possibly `fromData`) bridges the two. As a stepping stone, `validate`/`parse` may keep their thunk-based dispatch and only call into the data form for `or` normalization.

## Implications for `or`

Once the data form exists, `or` itself should be reverted to a lazy, allocation-free constructor: drop the current `reduceOr`/`flattenOr` pass and have `or(...types)` simply return a thunk that captures its arguments. All normalization — flattening, dedup, subset removal, coverage collapse, canonical ordering — moves to the data form and runs only once, when the schema is converted via `toData` ahead of validation, parsing, or any other operation that needs a canonical view. Schemas that are constructed but never used pay nothing; schemas that are used pay a single one-shot conversion.

## Related

- [130](./130-or-optimization.md) — depends on this issue; the remaining goals (canonical ordering, structural subset, coverage collapse) are naturally expressed on the data form.
- [141](./README.md) — universal, extensible type system based on custom RTTI. The `equal`/`subset` predicates introduced here are the first concrete instance of the proposed `TypeSystem<T>` interface.

## Location

`fs/types/rtti/data/module.f.ts` (new), with `test.f.ts` alongside.
