## nullable-repeat-item. `AstRule` flattens a repetition the runtime refuses

**Priority:** P3
**Status:** open

### Problem

`AstRule` classifies a repetition structurally: the rule is a lazy two-branch
variant whose `some` tail is the rule itself. `repeatOf` in
[`../../data/module.f.mjs`](../../data/module.f.mjs) asks for one thing more —
`emptyTags[item] !== undefined` rejects an item that can match empty, since a
body consuming nothing has infinitely many parses of the same input.

So a rule such as `Repeat0Plus<readonly []>` gets `readonly (readonly [])[]`
from `AstRule` while `repeatItem` returns `null` for it. The type describes an
AST the parser will not build.

The consequence is bounded: the grammar is one the runtime refuses outright, so
the wrong type belongs to a rule that does not work either way. It is not a
valid grammar given a wrong shape, which is what the other repeat-detection
defects were.

### Why it is not a guard

Mirroring the check needs a type-level answer to "can this rule match empty?",
and the recursive rule shape defeats the direct encoding. Written the obvious
way — a terminal is `false`, an empty sequence `true`, a sequence `true` when
every element is, a variant `true` when any branch is — it gives `boolean`
rather than `true` for an ordinary `Repeat0Plus<0>`, and on
`Repeat0Plus<readonly []>`, the case this issue is about, TypeScript reports
`TS2615`: the mapped type's `some` property circularly references itself.

That is the same recursion `emptyTagMap` handles, and it handles it by working
over a *normalized, finite* rule set where each rule is a name, computing a
fixpoint. `AstRule` walks the functional rule tree directly and has no rule set
to reach a fixpoint over, so the analysis is a piece of work in its own right
rather than a condition to add to the existing test.

### Proposal

Either:

- Derive the AST from the normalized rule set rather than the functional rule,
  which is where the nullability answer already lives — this is the larger
  change, and would let every `repeatOf` condition be mirrored rather than this
  one; or
- Restrict the type: give `AstRule` a shape it can honestly derive, and say in
  the module documentation that a repetition over a nullable item is outside
  it.

Until then the limit is stated in
[`../types.ts`](../types.ts)'s module documentation.

### Tasks

- [ ] Decide between deriving from the rule set and documenting the restriction.
- [ ] If the analysis is written, pin `Repeat0Plus<readonly []>` and a
      repetition over a variant with an empty branch with `Assert<Equal<…>>`.
- [ ] `tsc`, `fjs t`.

### Related

- [`../../data/module.f.mjs`](../../data/module.f.mjs) — `repeatOf` and
  `emptyTagMap`, the conditions this issue is measured against.
- [`../types.ts`](../types.ts) — `AstRule` and the module documentation stating
  the limit.
