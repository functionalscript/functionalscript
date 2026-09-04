## exact-key-types. What the map does not check about a key

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

- **A symbol-keyed property.** `definedEntries` reads own string keys, as
  the lowering's `entries` does, so `{ a: 'x', [meta]: 42 }` and
  `{ a: 'x' }` are one rule to the rewrite and to the grammar they lower
  to — and two to `Equal`, which sees the symbol. The rewrite and the
  lowering agree here; it is the types that see more than either.

The shape recurs wherever an annotation says less, or other, than the
value — a hand-written repeat thunk whose bound is a variable, a `Rule`
cast — and `_Exact` cannot see through an annotation. Each check it gains
is one more step of a type that walks a value toward TS2589
([REVIEWING.md](../../../../doc/REVIEWING.md#type-level-computation)).

### A key that is no rule

A key is a rule the author holds, and nothing checks that it is one: the
walk validates the rule it is given, not the keys it is matched against.
An invalid key is inert, since no valid rule is alike to it — except
`-0`, which `===` conflates with `0`, so `rewrite([[-0, f]])(0)(0)` is
`f(0)` where a map keyed by `-0` should be refused as `-0` is refused as
a rule.

The value is not wrong — it is what a map keyed by `0` gives, and what
`Mapped` predicts, since `tsc` reads `-0` as the literal `0` — so this is
strictness, not silence. Refusing it properly means validating a key as
a rule, at any depth, which is a walk this module does not have: its
walk validates against an AST, and a key has none. A number-only check
would refuse the reported input and still admit `[-0]` beside `[0]`, so
it would promise more than it holds.

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

- [ ] Decide, against the depth budget, which of the type-level checks
      are wanted: the `max` row, the tuple length, the readonly
      spelling, the symbol-keyed property.
- [ ] Add those, each with its `Checked` assertion.
- [ ] Decide whether a key is validated as a rule, and if so, where the
      validator lives — a rule walk without an AST is one this module
      does not have and the lowering does.

### Related

- [`../README.md`](../README.md) — "Typed: the map proves what a mapping
  declared", where `_Exact`'s rule is stated.
- [`../module.f.mjs`](../module.f.mjs) — `find` and `alikeBy`, which
  match a key against a rule.
- [REVIEWING.md](../../../../doc/REVIEWING.md#type-level-computation) — why
  a check on an input the code already accepts is a `todo/` first.
