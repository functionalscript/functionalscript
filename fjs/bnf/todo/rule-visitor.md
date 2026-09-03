## rule-visitor. Share `Rule` discrimination via a visitor in `bnf/data`

**Priority:** P4
**Status:** blocked
**Blocked by:**
- [Separate alphabet-specific BNF helpers](./unicode-rules.md)
- [ebnf-front-end](./ebnf-front-end.md)'s Problem 1 — which bounds the data
  layer represents natively. If it grows a bounded repeat, the data `Rule`
  union this visitor discriminates changes, and a visitor written against
  today's string-only `Repeat` needs a second rewrite.

### Problem

The current `Rule` discrimination is hand-rolled at several sites. Today it is
based on the pre-migration representation (`typeof rule === 'number'`, array,
otherwise variant), while `DataRule` also has a string-specific path.

That is a maintenance liability because every new or changed rule shape requires
parallel edits across the parser backends. The `Repeat` rule kind demonstrated
it: adding it meant a new dispatch branch at every site, kept honest only by the
shared `isRepeat` discriminator it introduced.

One piece of surrounding BNF work still changes those assumptions before this
TODO can be implemented: the alphabet split removes raw `string` as a generic
`DataRule` / `Rule` case.

The terminal representation does **not** change. The bigint symbol/range
migration would have replaced the number-based terminal and its discriminant, but
it is [on hold](./bigint-symbols.md), so the visitor targets the shipped
representation — a `number` terminal — rather than waiting for a union that is not
coming.

### Proposal

After the alphabet split settles the generic `Rule` union, add a visitor in
`fjs/bnf/data/module.f.mjs` (the module that owns the type), mirroring the proven
`visit` pattern in `fjs/rtti/common`.

Conceptually the visitor exposes the semantic rule cases:

```ts
export type RuleVisitor<R> = {
    readonly terminal: (r: TerminalRange) => R
    readonly sequence: (s: Sequence) => R
    readonly variant: (v: Variant) => R
}
```

This type sketch names semantic cases only. The concrete `matchRule`
discrimination follows the representation the tree has: a `number` terminal, an
array sequence, an object variant, a string `Repeat`. Do not add a generic string
branch after the alphabet split removes one.

Centralizing `typeof rule === 'number'` in the visitor is the point of the task,
not a compromise: one discriminator to change is exactly what makes a future
terminal-representation migration cheap, should
[bigint-symbols](./bigint-symbols.md) ever revive.

`emptyTagMapAdd`, `descentParser`'s rule matcher, and LL(1) dispatch then use the
shared visitor instead of independently re-deriving the rule discriminant. If a
future rule kind such as `Repeat` is added, it should become one new visitor
member so the type checker forces every backend to handle it.

Keep the abstraction exactly this narrow: a discriminator, not a recursion
scheme. Each call site keeps its own recursion/accumulator structure.

### Tasks

- [ ] Wait for the alphabet split to settle the generic `Rule` union.
- [ ] Define `RuleVisitor` / `matchRule` in `fjs/bnf/data/module.f.mjs` against the
      shipped discriminants, terminals included; do not depend on the obsolete
      raw-string rule.
- [ ] Rewrite the backend dispatch sites to use the shared visitor.
- [ ] Keep any alphabet-specific lowering outside this generic visitor.
- [ ] Absorb `isRepeat` from `fjs/bnf/data/module.f.mjs` into the visitor, so the
      repetition case has one discriminator rather than a predicate beside it.
- [ ] Add proof coverage for every final `Rule` case so a newly added case cannot
      be silently skipped by a backend.
- [ ] `tsc`, `fjs t`.

### Related

- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — **blocks this
  task** by removing the current generic string rule.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — no longer blocks this task.
  It blocked it only because the terminal discriminant was expected to change
  from `typeof rule === 'number'`; that migration is on hold, so the visitor can
  be written against the representation the tree actually has.
- [`../data/README.md`](../data/README.md#the-repeat-rule) — the `Repeat` case
  the visitor has to cover; both backends now match it iteratively.
- `nullable-analysis-shared` (retired; shipped as
  [`emptyTagMap`](../data/module.f.mjs) in `fjs/bnf/data`, commit `94b7ff06`,
  which deleted the issue in the same change and is documented at
  [`../data/README.md`](../data/README.md)) — the shared nullability pass, which
  both backends now read from instead of re-deriving. It is still the natural
  consumer of this visitor: `emptyTagMap` walks the rule tree itself, so it is
  one of the traversals a `Rule` visitor would absorb.
- `fjs/rtti/common/module.f.mjs` — existing `visit` precedent.
- [ebnf-front-end](./ebnf-front-end.md) — a second functional front end.
  Whether it changes the data `Rule` union this visitor discriminates is its
  Problem 1, which is why that is a blocker above.
  [grammar-bucket](../../todo/grammar-bucket.md) moves this issue to
  `data/todo/` with the module.
