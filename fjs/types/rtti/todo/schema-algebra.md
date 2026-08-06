## Set-theoretic schema algebra

**Priority:** P3
**Status:** open
**Blocked by:** [Serializable data form](./data-form.md)

### Problem

rtti has no schema algebra, and nowhere to put one.

`or` is a lazy constructor that captures its arguments and stops there — no
flattening, no de-duplication, no subset analysis, no canonical form. That is
the right call for a *construction surface*, but it means none of the following
is defined anywhere:

- **equality** — `or(a, b)` and `or(b, a)` are two unrelated thunks;
- **subset** — is every value matching X also matched by Y?
- **normalization** — `or(or(a, b), c)` never collapses; `or(true, false)` never
  becomes `boolean`; a variant subsumed by a sibling is never dropped;
- **canonical ordering** — no stable order for variants, so no comparison, no
  hashing, no deterministic serialization.

Doing any of it on the thunk graph is the wrong layer: it would push allocation
and analysis into every `or(...)` call, and it cannot work on recursive schemas
at all.

### Open design questions

The concrete node shape is **the open question**, and it is the reason this is
split from [data-form](./data-form.md): that issue's reference spine is
mechanical and precedented, while this one is research. The spine ships with a
provisional payload mirroring today's `Type` ADT; this issue may replace that
payload entirely, and the spine should not have to change when it does.

The design should be grounded in **set theory**: a `Type` denotes a set of
values and `or` is union, so union, intersection, subset, and equality ought to
fall out of the representation instead of being tag-by-tag case analysis.
Directions to explore, none of them decided:

- **Top level as a union over non-overlapping kinds.** A schema is a disjoint
  union over a fixed set of kinds (`null`-ish, booleans, numbers, strings,
  bigints, arrays/tuples, records/structs), each contributing its own
  sub-representation. Kinds do not overlap, so the set operations reduce to
  kind-wise operations.
- **Finite-domain kinds as bitsets.** `null`, `undefined`, `true`, `false` are
  singletons of a small fixed enumeration, so a bitset captures any subset of
  them and `or(true, false)` collapses to `boolean` because the bits are set —
  no special-case rule. See
  [bit-set-factory](../../todo/bit-set-factory.md).
- **Arrays and tuples are one kind.** A tuple is an array with a constrained
  length and per-position element types; the value sets overlap
  (`readonly [number]` ⊂ `readonly number[]`), so separate variants cannot
  express the relation.
- **Records and structs are one kind,** for the same reason: a struct is a
  record with constrained keys and per-key value types.
- **How references interact with the algebra.** Normalizing across a named
  reference means normalizing a *recursive* type — where subtyping stops being
  structural induction and needs a coinductive or automaton-based treatment.

Prior art to read before committing to a shape: CDuce / Castagna on semantic
subtyping, and BDD-based encodings of set-theoretic types. Both have worked out
canonical forms and decidable subtyping for recursive types.

### Implications

Once this lands, `or` stays exactly as it is today — a one-line lazy
constructor — and every property that a normalizing `or` would have provided
becomes a property of the data form by construction, available uniformly to
every consumer rather than only to values built through `or`. "Optimize `or`"
is therefore not a separate project.

### Tasks

- [ ] Choose the kind decomposition and each kind's sub-representation.
- [ ] Decide how named references participate in normalization and subtyping.
- [ ] Define `equal`, `subset`, `union`, and canonical ordering over the shape.
- [ ] Replace [data-form](./data-form.md)'s provisional payload, leaving its
      reference spine untouched.
- [ ] Prove the collapses the shape is meant to make free: `or(true, false)` to
      `boolean`, nested `or` flattening, subsumed-variant drops, and
      order-independent equality.

### Related

- [Serializable data form](./data-form.md) — the reference spine this builds on;
  split from this issue so it is not gated on open research
- [141](../../todo/141.md) — universal, extensible type system based on custom
  RTTI; `equal`/`subset` here are the first concrete instance of its
  `TypeSystem<T>` interface
- [bit-set-factory](../../todo/bit-set-factory.md) — the bitset machinery the
  finite-domain kinds would use
- [fjs/types/rtti/module.f.ts](../module.f.ts) — `or`'s JSDoc, which already
  states that all such algebra belongs on the data form
