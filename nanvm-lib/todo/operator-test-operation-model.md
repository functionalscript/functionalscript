## operator-test-operation-model. Describe operations by syntax and arity

**Priority:** P3
**Status:** irrelevant — superseded by
[reuse-edag-operators](../../fjs/nanvm/todo/reuse-edag-operators.md)

### Problem

The shared operator corpus in `fjs/nanvm/` uses implementation-style names
(`'unaryPlus' | 'unaryMinus' | 'mul' | 'stringCoercion'`) and types `Case.args`
as `readonly Value[]`, so an operation is not connected to its operand count.
This todo, following the post-merge review of #1489, proposed fixing both with
a local semantic descriptor carrying a name and an arity:

```ts
export type Operation<N extends number = number> =
    readonly [name: string, argsN: N]   // ['+', 1], ['*', 2], ['String', 1]
```

### Why superseded

[`fjs/edag/`](../../fjs/edag/README.md) now ships the canonical operation
vocabulary this descriptor would have duplicated: `op1Id`/`op2Id` in
[`module.f.mjs`](../../fjs/edag/module.f.mjs) and `Op1Id`/`Op2Id` in
[`types.ts`](../../fjs/edag/types.ts). There, arity is not an annotation but
the group a tag belongs to (`op1`/`op2`), and every tag is unique — negation is
`neg`, not an arity-overloaded `-`, and there is no unary `+` at all — so the
`[name, argsN]` disambiguation scheme has nothing left to disambiguate, and a
local model would be a second vocabulary able to drift from the canonical one.

The corpus redesign therefore reuses the EDAG definitions instead;
[reuse-edag-operators](../../fjs/nanvm/todo/reuse-edag-operators.md) carries
the plan, including this todo's still-applicable requirements:

- semantic operator spellings instead of implementation names — now the
  canonical `Op1Id`/`Op2Id` spellings;
- arity-aware case types with wrong argument counts rejected statically — now
  `Case<1>`/`Case<2>` derived from the id's group;
- `commutative` restricted to binary groups;
- stable case names as proof keys, with the explicit `Swapped` disambiguation
  (equal-argument commutative cases make the name, not the expression, the
  unique key);
- diagnostics rendered as faithful source literals (`123` vs `123n`, `0` vs
  `-0`), with explicit `Object.is`/throw forms where `===` would misdescribe
  the comparison;
- consumer-owned mapping to JavaScript/Rust implementations — in particular no
  `snakeCase` over punctuation tags, and no Rust identifiers leaking into the
  shared data;
- `eq` (`===`) kept outside the generic group model for now.

### Related

- [reuse-edag-operators](../../fjs/nanvm/todo/reuse-edag-operators.md) — the
  superseding plan.
- #1489 — introduced the shared operator corpus.
- #1489 review: https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770780551
- #1489 review: https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770797058
