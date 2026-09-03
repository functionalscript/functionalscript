## nullable-repeat-item. `AstRule` flattens repetitions the runtime refuses

**Priority:** P3
**Status:** open

### Problem

`AstRule` classifies a repetition from the rule alone: a lazy two-branch
variant, one branch the empty sequence, the other the item paired with the rule
itself. `repeatOf` in [`../../data/module.f.mjs`](../../data/module.f.mjs) asks
for two things more, and neither can be answered from the rule:

- `emptyTags[item] !== undefined` rejects an item that can match empty, since a
  body consuming nothing has infinitely many parses of the same input.
- `contains(name)(reachable(ruleSet)(item))` rejects an item that can reach the
  rule again, so that the rule's only self-reference is the tail one.

So `Repeat0Plus<readonly []>` and a repetition whose item refers back to the
repetition both get an array from `AstRule`, while `repeatItem` returns `null`
for each. The type describes an AST the parser will not build.

The consequence is bounded, and is what makes this a `todo/` rather than a fix:
both are grammars the runtime refuses outright, so the wrong type belongs to a
rule that does not work either way. That is unlike the repeat-detection defects
fixed in the same pull request — extra branches, and branch names other than
`some`/`none` — each of which gave a wrong shape to a grammar that *does*
parse.

### Why neither is a guard

Both conditions are questions about a rule *set*, not about a rule.
`reachable` walks a set of named rules; there is no set here to walk, and a
structural type has no name to be reached.

Nullability is the one that shows the shape of the problem concretely.
Mirroring it needs a type-level answer to "can this rule match empty?", and the
recursive rule shape defeats the direct encoding. Written the obvious
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
- [ ] If the analysis is written, pin `Repeat0Plus<readonly []>`, a repetition
      over a variant with an empty branch, and a repetition whose item reaches
      the repetition, with `Assert<Equal<…>>`.
- [ ] `tsc`, `fjs t`.

### Related

- [`../../data/module.f.mjs`](../../data/module.f.mjs) — `repeatOf`,
  `emptyTagMap` and `reachable`, the conditions this issue is measured against.
- [`../types.ts`](../types.ts) — `AstRule` and the module documentation stating
  the limit.
