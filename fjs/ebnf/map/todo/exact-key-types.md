## exact-key-types. What `_Exact` does not see in a key's type

**Priority:** P4
**Status:** open

### Problem

`Checked` in [`../types.ts`](../types.ts) admits a key only where its type
says its parts, through `_Exact`, so that a key found by type equality is
the rule the runtime finds by its parts. `_Exact` reads a literal, a tuple
and a variant element by element, a set's spelling down to its arguments,
and a repetition's `min` and item. It does not read a repetition's `max`,
because `number` there is `Infinity`'s spelling and no other bound's — the
front end's constructors refuse a bound that is not a literal.

A union-typed bound passes that refusal: `repeat(0, max)` for a `max` of
type `1 | 2`, from a helper that returns either, is one type for two
rules. Mapping the one with `max` `1` types the one with `max` `2` as
mapped, where the rewrite leaves it as it is, since the two are not one
spelling. A parent mapping declared against the typed children may then
receive the array where its declaration says the output. The runtime is
right; the type is wider than it claims.

The same shape recurs wherever an annotation says less than the value —
a hand-written repeat thunk whose bound is a variable, a `Rule` cast — and
`_Exact` cannot see through an annotation. Each check it gains is one more
step of a type that walks a value toward TS2589
([REVIEWING.md](../../../../doc/REVIEWING.md#type-level-computation)).

### Proposal

Read `max` as `min` is read, with `number` kept for `Infinity`:

```ts
R extends Repeat<infer Min, infer Max, infer D>
    ? _Literal<Min> extends true
        ? number extends Max ? _Exact<D> : _Literal<Max> extends true ? _Exact<D> : false
        : false
    : false
```

with a `Checked` assertion for `Repeat<0, 1 | 2, 'x'>` refused, beside the
ones in `types.ts`. Whether it is worth the step is the question this issue
holds open: no grammar in the repository builds a bound from a union, and
the runtime already answers the case correctly.

### Tasks

- [ ] Decide whether the check is wanted, against the depth budget.
- [ ] If so, the `max` row above, and the assertion.

### Related

- [`../README.md`](../README.md) — "Typed: the map proves what a mapping
  declared", where `_Exact`'s rule is stated.
- [REVIEWING.md](../../../../doc/REVIEWING.md#type-level-computation) — why
  a check on an input the code already accepts is a `todo/` first.
