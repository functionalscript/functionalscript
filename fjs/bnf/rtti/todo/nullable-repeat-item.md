## nullable-repeat-item. `AstRule` and `repeatOf` disagree where a rule set is needed

*(The slug names the first case found; the issue grew to three.)*

**Priority:** P3
**Status:** open

### Problem

`AstRule` classifies a repetition from the rule alone: a lazy two-branch
variant, one branch the empty sequence, the other the item paired with the rule
itself. `repeatOf` in [`../../data/module.f.mjs`](../../data/module.f.mjs) asks
for more, and none of it can be answered from the rule:

- `emptyTags[item] !== undefined` rejects an item that can match empty, since a
  body consuming nothing has infinitely many parses of the same input.
- `contains(name)(reachable(ruleSet)(item))` rejects an item that can reach the
  rule again, so that the rule's only self-reference is the tail one.
- A refusal does not propagate out of a branch. Normalization is eager, so a
  malformed rule nested under a variant stops the whole grammar being built —
  `toData({ a: { bad: undefined }, c: 1 })` throws — while `AstRule` gives
  `{ a: never } | { c: number }`, still inhabited through the valid
  alternative. Propagating it means asking whether each branch's own AST is a
  refusal *before* producing the rule's, which is circular for a rule whose
  branch refers back to it: attempting it makes the self-referential
  three-branch variant of `_20` report `TS2589`. It is the nullability
  obstruction again, reached from the other side.
- An *optional* branch may be omitted by a value the type admits, and then the
  rule has fewer branches than it declares. `{ none?: [], some?: [0, R] }`
  describes four grammars — both branches, either alone, neither — and only the
  first is a repetition: `repeatItem` returns the item for it and `null` for
  `{ none: [] }` on its own. `_29` picks the both-present reading, which is a
  choice among the four rather than the answer, and the same choice `_12` makes
  for variants. Deciding it properly needs the value, or a rule set built from
  one.
- A branch whose declared type is a *union of rules* is not distributed over
  during recognition. `{ none: readonly [] | 1, some: [0, R] }` describes both a
  repetition (when `none` is the empty sequence) and an ordinary variant (when
  it is the terminal), and `repeatItem` returns the item for the first; the
  tests here read the union whole, match neither shape, and give the variant.
  Distributing it is not one more predicate: the members multiply across
  branches, so recognizing every combination of an `N`-branch rule whose
  branches have `M` members is `M^N` shapes.
- `stepRule[1] !== name` asks whether the tail *is this rule*, by name. The
  type-level test asks whether the tail has this rule's shape, and those differ:
  given two separate declarations both spelled
  `() => { none: [], some: [0, B] }`, the tail of the first is `B` rather than
  itself, so `repeatOf` leaves it a variant while `AstRule` reads a repetition.

So `Repeat0Plus<readonly []>`, a repetition whose item refers back to the
repetition, and a rule whose tail is a structurally identical *other* rule all
get an array from `AstRule` while the parser builds a variant. The type
describes an AST the parser will not build.

The consequence is bounded, and is what makes this a `todo/` rather than a fix:
both are grammars the runtime refuses outright, so the wrong type belongs to a
rule that does not work either way. That is unlike the repeat-detection defects
fixed in the same pull request — extra branches, and branch names other than
`some`/`none` — each of which gave a wrong shape to a grammar that *does*
parse.

### Two more, from different causes

An object-literal `__proto__` branch — `const r = { __proto__: 0 } as const` —
is accepted as a `Rule`, and `AstRule<typeof r>` gives
`{ readonly __proto__: number }`. JavaScript treats that literal key as the
prototype setter rather than an own property, so `Object.entries` in
[`../../data/module.f.mjs`](../../data/module.f.mjs) sees no branches at all and
`toData(r)` produces an empty variant. The advertised branch can never exist.

This one is *not* a rule-set question, and is the only limit here with a cheap
and exact fix: the key is gone before a rule set is built, and `__proto__` is a
single known name, so excluding it from `_Keys` is precise rather than a guess.
A variant declaring only `__proto__` would then correctly refuse. Worth doing on
its own rather than waiting for the larger change.

### One more, from a different cause

A variant keyed by a *pattern* — `{ [k in `x-${string}`]: 0 }` — is an open key
set like an index signature over `string` or `number`, and is not recognized as
one. It is enumerated instead, so `AstRule` gives a required pattern index
signature and an arbitrary key such as `ast['x-missing']` types as present,
where a parse selects one branch.

This one is not a rule-set question; it is that TypeScript does not distinguish
a finite union of string literals from an infinite pattern type. `string
extends K` catches only `string` itself, and the obvious alternatives —
`` K extends `${infer _}` `` and `[K] extends [string]` — are true of `'x-a' |
'x-b'` and of `` `x-${string}` `` alike. There is no sound test to add a third
arm to the open-key check with, so the widened answer cannot be given to
exactly the shapes that deserve it.

Deriving from a rule set closes this too, for a different reason than the
others: a rule set has actual keys, so nothing has to be inferred about how
many a type admits.

### Why none of them is a guard

All six are questions about a rule *set*, not about a rule. `reachable` walks
a set of named rules; there is no set here to walk, and a structural type has
no name to be reached.

The identity condition puts it beyond reach rather than merely inconvenient.
TypeScript is structurally typed, so two rules with the same shape are not
"hard to tell apart" — they are the *same type*, and `Assert<Equal<A, B>>`
holds for the pair above. No test written against the type can separate them,
whatever it asks.

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
      over a variant with an empty branch, a repetition whose item reaches the
      repetition, a rule whose tail is a structurally identical other rule, and
      a malformed rule nested under a variant with a valid alternative, with
      `Assert<Equal<…>>`.
- [ ] `tsc`, `fjs t`.

### Related

- [`../../data/module.f.mjs`](../../data/module.f.mjs) — `repeatOf`,
  `emptyTagMap` and `reachable`, the conditions this issue is measured against.
  Deriving from the rule set would settle all three at once, since a rule set is
  exactly what supplies the names they are phrased in.
- [`../types.ts`](../types.ts) — `AstRule` and the module documentation stating
  the limit.
