## nullable-repeat-item. `AstRule` and `repeatOf` disagree where a rule set is needed

*(The slug names the first case found; the issue grew to ten.)*

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
- `stepRule[1] !== name` asks whether the tail *is this rule*, by name. The
  type-level test asks whether the tail has this rule's shape, and those differ:
  given two separate declarations both spelled
  `() => { none: [], some: [0, B] }`, the tail of the first is `B` rather than
  itself, so `repeatOf` leaves it a variant while `AstRule` reads a repetition.

So `Repeat0Plus<readonly []>`, a repetition whose item refers back to the
repetition, and a rule whose tail is a structurally identical *other* rule all
get an array from `AstRule` while the parser builds a variant. The type
describes an AST the parser will not build.

The first two are grammars the runtime refuses outright, so the wrong type
belongs to a rule that does not work either way. **The tail-identity case is
not**, and it is the worst of the three for that reason. Given

```js
const B = () => ({ none: [], some: [0, B] })
const A = () => ({ none: [], some: [0, B] })
```

`repeatItem(B)` returns `0` and `repeatItem(A)` returns `null`; `toData(A)`
builds a five-rule set entered at `A`, and the descent parser matches the empty
input against it, answering `{ tag: 'none', sequence: [] }`. `A` is a grammar
that works, and `AstRule<A>` calls it `readonly number[]`. That is the same kind
of defect as the repeat-detection ones fixed in the same pull request — extra
branches, and branch names other than `some`/`none` — rather than the bounded
kind, and it is the strongest argument for deriving from the rule set.

### Six more, from different causes

An *open* key set whose value type admits `undefined` —
`{ readonly [k: string]: 0 | undefined }` — is answered with the widened variant
rather than refused, though `toData(() => ({ a: undefined }))` throws with
`Cannot convert undefined or null to object`. `_Branches` reaches the open-key
arm before `_Malformed`, and reordering the two is not available: `Variant`
itself is `{ readonly[k in string]?: Rule }`, and `Required` does not take the
`?` off a *mapped* index signature the way it does off a literal key, so
`Required<Variant>[string]` is `Rule | undefined` and `_Malformed<Variant>` is
`string`. Refusing first would make `AstRule<Variant>` — and with it the whole of
`json`, whose `value` is annotated `Variant` — resolve to `never`.

Separating the two needs a test for "this index signature is optional" that does
not also fire on "this value type includes `undefined`", and there is none:
`Required<U>[K]`, `U[K]` and a `Pick`-based optionality probe all give the two
declarations the same answer. `{} extends Pick<{ readonly [k: string]: 0 |
undefined }, string>` holds, because an index signature demands no property.

The rule-set derivation closes this like the rest: normalization has the value,
and either throws on it or does not.

A declared key set is a *lower bound*, not the branches a value carries.
TypeScript object types are inexact outside a fresh literal, so

```ts
const extra = () => ({ none: [], some: [0, extra], other: 1 })
const r: R = extra          // `R` declares only `none` and `some`
```

type-checks, and `Object.entries` then sees three branches where the type names
two: `repeatItem(r)` is `null` and a match can produce `{ other: number }`, while
`AstRule<R>` reads a repetition.

There is nothing to fix short of not trusting a key set at all, which is the
module: every answer here counts the branches a declaration names. It is the
same fact as the tail-identity case above — a structural type describes a set of
values rather than the one in hand — and the same remedy: a rule set holds the
value's own keys.

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

An *overloaded* rule function is read at the wrong overload. `infer` takes the
last call signature, and the parser calls the rule with no arguments, so for

```ts
declare function r(): 0
declare function r(x?: string): { readonly a: 1 }
```

`AstRule<typeof r>` is `{ readonly a: number }` where `r()` produces a terminal.
`Assert<Equal<typeof r extends () => infer V ? V : never, { readonly a: 1 }>>`
holds, checked with `tsc`.

This one is not a rule-set question either; it is that a conditional type cannot
pick an overload by argument count. Selecting one needs the overload list
written out — `typeof r extends { (): infer V, (x?: string): unknown } ? V`
— which is the declaration itself, not something derivable from it. The rule-set
derivation closes it by calling the rule rather than reading its type.

An open key set with a *required literal branch* beside it —
`() => StringMap<Rule> & { readonly fixed: 0 }` — is widened rather than given
the exact answer. It can never be a repetition: `fixed` is a terminal and is
carried by every value, so one more branch cannot supply both the empty branch
and the step, and two more make three. `_OpenRepeat` reads the branch type as
`Required<U>[string]`, which is the index signature's `Rule` with `fixed`'s `0`
folded into it, so it answers "could be either" and `AstRule` carries an array
the parser can never produce.

The literal key is out of reach: `keyof (StringMap<Rule> & { fixed: 0 })` is
`string | 'fixed'`, which TypeScript reduces to `string` —
`Assert<Equal<keyof …, string>>` holds. There is no name left to index by, and
so nothing to ask about the branch it names. A rule set has the keys the value
turned out to carry.

A repetition whose item holds a union *below its top level* admits arrays whose
elements differ, where a grammar fixes one. The item of

```ts
() => ({ none: [], some: [[0 | [0]], R] })
```

is the one-element sequence `readonly[0 | readonly[0]]`, and its AST is
`readonly[number | readonly[number]]` — exact for one occurrence, since the
element is one or the other — but the repetition over it then admits
`[[0], [[0]]]`, which no parse produces: `toDataAdd` evaluates the rule once and
fixes that element.

The top level is handled — `_One` wraps each member of the item, and `_Items`
each member of the step, so a union directly in either place gives one array per
alternative. Below that it is the `M^N` problem again, the one that rules out
distributing a variant's branches: making the answer exact means normalizing a
rule type into the union of the concrete rules it describes, and a rule with `N`
union sites of `M` members each describes `M^N` of them. It is also not confined
to the item — the same is true of any sequence element under a repetition.

So this is a *loss of precision* rather than a wrong shape: the type admits
arrays the parser will not build, and every array it will build is in it. A rule set closes it by holding the alternative the rule
turned out to be, which is one rule rather than a type describing many.

### Why none of them is a guard

All four in the first list are questions about a rule *set*, not about a rule.
`reachable` walks a set of named rules; there is no set here to walk, and a
structural type has no name to be reached.

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
      repetition, a rule whose tail is a structurally identical other rule, a
      malformed rule nested under a variant with a valid alternative, and an
      open key set whose value type admits `undefined`, with
      `Assert<Equal<…>>`.
- [ ] `tsc`, `fjs t`.

### Related

- [`../../data/module.f.mjs`](../../data/module.f.mjs) — `repeatOf`,
  `emptyTagMap` and `reachable`, the conditions this issue is measured against.
  Deriving from the rule set would settle all three at once, since a rule set is
  exactly what supplies the names they are phrased in.
- [`../types.ts`](../types.ts) — `AstRule` and the module documentation stating
  the limit.
