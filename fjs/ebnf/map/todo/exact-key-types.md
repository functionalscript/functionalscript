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

Two more inputs of the same shape, each named by a reviewer:

- **A variable-length array.** A key typed `readonly 42[]` holds `[42]` at
  runtime, and every element is exact, so `_Exact` admits it; a separately
  held `[42, 42]` of that same type is then typed as mapped where the
  rewrite leaves it, since the two are not one spelling. The tuple row
  never asks whether `R['length']` is a literal.
- **A mutable tuple.** `_Find` matches by `Equal`, which tells
  `readonly [42]` from `[42]`, where the runtime sees one array and maps
  it. So a key spelled one way and a rule spelled the other are one rule
  to the rewrite and two to the types — the opposite direction from the
  rows above, and reachable only through an annotation, since a rule
  built by the constructors or pinned `const` is readonly.

The shape recurs wherever an annotation says less, or other, than the
value — a hand-written repeat thunk whose bound is a variable, a `Rule`
cast — and `_Exact` cannot see through an annotation. Each check it gains
is one more step of a type that walks a value toward TS2589
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
ones in `types.ts`. A variable-length array is one more row — the tuple
branch asking `_Literal<R['length']>` — and a mutable tuple one more,
either normalized (compare `readonly [...R]`) or refused. Whether any of
them is worth its step is the question this issue holds open: no grammar
in the repository writes a rule any of these ways, every rule the
constructors build or a `const` pins is exact and readonly, and the
runtime answers each case correctly.

### Tasks

- [ ] Decide, against the depth budget, which of the three checks are
      wanted: the `max` row, the tuple length, the readonly spelling.
- [ ] Add those, each with its `Checked` assertion.

### Related

- [`../README.md`](../README.md) — "Typed: the map proves what a mapping
  declared", where `_Exact`'s rule is stated.
- [REVIEWING.md](../../../../doc/REVIEWING.md#type-level-computation) — why
  a check on an input the code already accepts is a `todo/` first.
