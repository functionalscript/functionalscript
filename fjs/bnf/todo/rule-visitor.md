## rule-visitor. Share `Rule` discrimination via a visitor in `ebnf/data`

**Priority:** P4
**Status:** blocked
**Blocked by:** `fjs/ebnf/data/` existing
([ebnf-migration](../../todo/ebnf-migration.md)). The visitor discriminates
the EBNF data `Rule` union, so it is either part of that rewrite or the
first thing built on it — whichever the developer doing the rewrite prefers.

### Problem

The data `Rule` discrimination is hand-rolled at several sites. In
`fjs/bnf/` it is `typeof rule === 'number'`, array, string, otherwise
variant, re-derived by `emptyTagMap`, the descent matcher and LL(1)
dispatch independently, and kept honest only by the shared `isRepeat`
predicate the `Repeat` kind introduced. Adding that kind meant a new
dispatch branch at every site.

`fjs/ebnf/data/` starts with one more reason to centralize this: its
`Repeat` carries bounds (ebnf-front-end's Problem 1), so the union it
discriminates is not the classical one, and a discriminator written once
there is what keeps `fjs/ebnf/ll1/` and every later backend from each
re-deriving it.

The terminal representation is open. [ebnf-range-set](./ebnf-range-set.md)
replaces the packed `number` with a range set, and its carrier in the IR is
decided together with the bounded `Repeat`'s (ebnf-front-end's Problem 1). So
the visitor's `terminal` case takes whichever form that decision settles on,
and its discriminant is written once, after it: `typeof rule === 'number'`
is the classical `bnf/data` discriminant, not this visitor's. The bigint
symbol/range migration is [on hold](./bigint-symbols.md) and no longer a
factor, since a range set's boundaries need no fixed width.

### Proposal

Add a visitor in `fjs/ebnf/data/module.f.mjs` (the module that owns the
type), mirroring the proven `visit` pattern in `fjs/rtti/common`.

Conceptually the visitor exposes the semantic rule cases:

```ts
export type RuleVisitor<R> = {
    readonly terminal: (r: Terminal) => R   // the range-set carrier, once settled
    readonly sequence: (s: Sequence) => R
    readonly variant: (v: Variant) => R
    readonly repeat: (r: Repeat) => R
}
```

This type sketch names semantic cases only. The concrete `matchRule`
discrimination follows the representation the EBNF tree has, which the
`data/` rewrite decides; there is no generic string branch, because the
EBNF lowering expands a string rule to terminals before the data form
exists, exactly as `toData` does today.

Centralizing `typeof rule === 'number'` in the visitor is the point of the
task, not a compromise: one discriminator to change is exactly what makes a
future terminal-representation migration cheap, should
[bigint-symbols](./bigint-symbols.md) ever revive.

`emptyTagMap` and LL(1) dispatch then use the shared visitor instead of
independently re-deriving the rule discriminant. A future rule kind becomes
one new visitor member, so the type checker forces every backend to handle it.

Keep the abstraction exactly this narrow: a discriminator, not a recursion
scheme. Each call site keeps its own recursion/accumulator structure.

`fjs/bnf/` is not changed by this issue. Its sites may adopt the visitor
from `ebnf/data` if someone touching them wants one discriminator — the
`bnf → ebnf` direction allows it — and otherwise keep their own until `bnf/`
is deleted.

### Tasks

- [ ] Define `RuleVisitor` / `matchRule` in `fjs/ebnf/data/module.f.mjs`
      against that layer's discriminants, terminals and the bounded repeat
      included.
- [ ] Have `emptyTagMap` and `fjs/ebnf/ll1/` dispatch use the shared visitor;
      absorb any `isRepeat`-style predicate into it, so the repetition case
      has one discriminator rather than a predicate beside it.
- [ ] Keep any alphabet-specific lowering outside this generic visitor.
- [ ] Add proof coverage for every `Rule` case so a newly added case cannot
      be silently skipped by a backend.
- [ ] `tsc`, `fjs t`.

### Related

- [ebnf-migration](../../todo/ebnf-migration.md) — the plan whose
  `fjs/ebnf/data/` rewrite this issue is an input to; that plan moves this
  file to `fjs/ebnf/data/todo/` or absorbs it, as the developer prefers.
- [ebnf-front-end](./ebnf-front-end.md) — its Problem 1 decides the bounded
  `Repeat` this visitor's `repeat` case sees.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — no longer blocks this
  task. It blocked it only because the terminal discriminant was expected to
  change from `typeof rule === 'number'`; that migration is on hold, so the
  visitor can be written against the representation the tree actually has.
- [`../data/README.md`](../data/README.md#the-repeat-rule) — the classical
  `Repeat`, unbounded and recognized by shape; the EBNF one carries bounds.
- `nullable-analysis-shared` (retired; shipped as
  [`emptyTagMap`](../data/module.f.mjs) in `fjs/bnf/data`, commit `94b7ff06`,
  which deleted the issue in the same change and is documented at
  [`../data/README.md`](../data/README.md)) — the shared nullability pass,
  which both classical backends read from instead of re-deriving. Its EBNF
  counterpart is the natural first consumer of this visitor: it walks the
  rule tree itself, so it is one of the traversals a `Rule` visitor absorbs.
- `fjs/rtti/common/module.f.mjs` — existing `visit` precedent.
